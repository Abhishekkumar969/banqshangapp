import React, { useEffect, useState } from "react";
import styles from "../styles/Vendor.module.css";
import { useLocation } from "react-router-dom";
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebaseConfig";
import BackButton from "../components/BackButton";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

const engagementServices = [
    "Cold Fire on stage",
    "Flower shower on stage",
    "Badal effect on stage",
    "Bubble effect on stage",
    "Blaster Confetti on stage",
    "Welcome Hostess on Gate",
    "Selfie mirror on 360",
    "LED Screen on live mode or Recorded",
    "Bride & Groom Light Board Standee",
    "Sun Board Standee",
    "Bridal Engagement Makeup",
    "DJ. Jockey Player",
    "Photography & Videography",
    "Bride & Groom Fog Entry & Fireworks (On Couple)",
    "Bride & Groom Light Follow Entry (On Couple)",
    "Bride & Groom Group Dance Entry (On Couple)",
    "Balloon & Fireworks Entry (On Couple)",
    "Male Singer / Female Singer",
    "Female Anchor / Male Anchor",
    "Live Band Musician",
    "Saxophonist (Male / Female)",
    "Professional Sound Engineer",
    "Light & Sound BFX Truss",
    "Car On Rental"
];

const weddingServices = [
    "Cold Fire on stage (During Varmala)",
    "Flower shower on stage (During Varmala)",
    "Badal effect on stage (During Varmala)",
    "CO2 Effects on stage (During Varmala)",
    "Bubble effect on stage (During Varmala)",
    "Blaster Confetti on stage (During Varmala)",
    "Jumbo Dropping on Stage (During Varmala)",
    "Bride & Groom Theme Entry",
    "Mirror Glass Walk",
    "Flower Décor on Ramp",
    "Fireworks on Ramp",
    "Platform for Ramp",
    "5D Floor Ramp Walk",
    "Fireworks on 5D Floor Ramp",
    "Outdoor Music",
    "Sehnai Vadak with Platform",
    "Welcome Hostess On Gate",
    "Musical Program Indoor (Male/Female Singer or Saxophonist)",
    "Male / Female Anchor",
    "Live Safa pagdi",
    "Barat Agaman (Trolley Band Light)",
    "Barat On wheels with letter",
    "LED Wall on Live Mode",
    "Photography & Videography",
    "Selfi Zone 360 Degree",
    "Solo Dancer",
    "Ganga Aarti Theme",
    "Outdoor Theme As per Requirement (By Guest)"
];

const defaultServices = [
    "Anchor (Male / Female)",
    "Singer (Male / Female)",
    "Dance Troop Theme Entry",
    "Flower Shower",
    "Cold Fire",
    "Dry Ice Effect",
    "Bubbles Flow Stage",
    "Blasters On Stage",
    "CO2 Effect Upper Air",
    "Magician",
    "Confetti",
    "360° Selfie Zone",
    "Photography & Videography",
    "Bridal Makeup",
    "Musical Saxophonist",
    "Live Safa Pagri",
    "Sahnai Vadak",
    "Welcome Hostess",
    "Live Band Musician",
    "Light + Sound + Truss",
    "LED Wall",
    "Platform",
    "DJ Jockey Player",
    "Mirror Ramp Walk",
    "Fireworks on Ramp Walk",
    "Bridal Room Light Board Standy",
    "Light & Band Baja",
    "DJ Trolley Band",
    "Dhol Bhangra",
    "Solo Dancer",
    "Special Sound Effect",
    "Car on Rent (BMW, Range Rover, Audi)",
    "Balloon Decoration (Thematic)",
    "Revolving Jai Mala Stage",
    "Crackers with Team of Barati",
    "Darbaan"
];

const predefinedEvents = [
    "Wedding",
    "Reception",
    "Engagement",
    "Birthday",
    "Anniversary",
    "Tilak",
    "Corporate Party",
    "Haldi & Mehandi"
];

const Vendor = () => {
    const location = useLocation();
    const [editData, setEditData] = useState(null);
    const [form, setForm] = useState({ customerName: "", address: "", contactNo: "", typeOfEvent: "", date: "", startTime: "", endTime: "", bookedOn: " " });
    const [customEvent, setCustomEvent] = useState("");
    const [services, setServices] = useState([]);
    const [customService, setCustomService] = useState("");
    const [showEventPopup, setShowEventPopup] = useState(false);
    const [eventSearchQuery, setEventSearchQuery] = useState("");
    const [formErrors, setFormErrors] = useState({});
    const [showValidationPopup, setShowValidationPopup] = useState(false);
    const [hasLoadedEditData, setHasLoadedEditData] = useState(false);
    const [isGSTManuallyEdited, setIsGSTManuallyEdited] = useState(false);
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [summaryFields, setSummaryFields] = useState({ totalPackageCost: "", discount: "", gstApplicableAmount: "", gstAmount: "", grandTotal: "", });
    const [enableRoyalty, setEnableRoyalty] = useState(false);

    useEffect(() => {
        if (location.state?.vendorData) {
            setEditData(location.state.vendorData);
        }
    }, [location.state]);

    const handleCustomEventEnter = (e) => {
        if (e.key === "Enter" && customEvent.trim()) {
            setShowEventPopup(false);
        }
    };

    useEffect(() => {
        if (hasLoadedEditData) return;

        const event = (customEvent || form.typeOfEvent || '').toLowerCase();
        let baseServices = [];
        if (event === 'engagement') baseServices = engagementServices;
        else if (event === 'wedding') baseServices = weddingServices;
        else baseServices = defaultServices;

        setServices(prevServices =>
            baseServices.map(s => {
                const existing = prevServices.find(ps => ps.name === s);

                // ✅ preserve existing values if available
                return existing
                    ? {
                        ...existing,
                        royaltyPercent: enableRoyalty
                            ? (existing.royaltyPercent || 30)
                            : 0,
                        royaltyAmount: ((parseFloat(existing.total) || 0) *
                            (enableRoyalty ? (existing.royaltyPercent || 30) : 0)) / 100,
                    }
                    : {
                        name: s,
                        remarks: '',
                        qty: '',
                        rate: '',
                        total: '',
                        royaltyPercent: enableRoyalty ? 30 : 0,
                        royaltyAmount: 0,
                    };
            })
        );
    }, [form.typeOfEvent, customEvent, hasLoadedEditData, enableRoyalty]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        let newValue = value;

        if (name === "customerName") {
            newValue = newValue.replace(/\b\w/g, (char) => char.toUpperCase());
        }

        setForm({
            ...form,
            [name]: newValue,
        });
    };

    const handleServiceChange = (index, field, value) => {
        const updated = [...services];
        updated[index][field] = value;

        const qty = parseFloat(updated[index].qty) || 0;
        const rate = parseFloat(updated[index].rate) || 0;
        updated[index].total = qty * rate;

        const royaltyPercent = parseFloat(updated[index].royaltyPercent) || 0;
        updated[index].royaltyAmount = (updated[index].total * royaltyPercent) / 100;

        setServices(updated);
    };

    const addCustomService = () => {
        if (customService.trim()) {
            setServices([
                ...services,
                { name: customService.trim(), remarks: "", qty: "", rate: "", total: "" }
            ]);
            setCustomService("");
        }
    };

    useEffect(() => {
        const total = services.reduce((sum, s) => {
            const amount = parseFloat(s.total);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

        const discount = parseFloat(summaryFields.discount) || 0;
        const autoGSTApplicable = total - discount;

        const manualGSTStr = summaryFields.gstApplicableAmount?.toString().trim();
        const manualGST = parseFloat(manualGSTStr);

        const useManual = isGSTManuallyEdited;

        const gstApplicable = useManual && !isNaN(manualGST) && manualGSTStr !== ""
            ? manualGST
            : autoGSTApplicable;

        const gstAmount = gstApplicable * 0.18;
        const grandTotal = (total - discount) + gstAmount;

        const format = (val) =>
            isNaN(val) ? "" : parseFloat(val) % 1 === 0 ? val.toString() : parseFloat(val).toFixed(2);

        setSummaryFields(prev => ({
            ...prev,
            totalPackageCost: format(total),
            gstAmount: format(gstAmount),
            grandTotal: format(grandTotal),
            ...(useManual
                ? {}
                : { gstApplicableAmount: format(autoGSTApplicable) }
            )
        }));
    }, [services, summaryFields.discount, summaryFields.gstApplicableAmount, isGSTManuallyEdited]);

    useEffect(() => {
        if (editData) {
            const gstAppAmtRaw = editData.summary?.gstApplicableAmount;
            const gstAppAmtStr = gstAppAmtRaw?.toString().trim();

            // ✅ Don't treat "0" as manual
            const manuallySet = gstAppAmtStr !== "" && gstAppAmtStr !== "0" && !isNaN(parseFloat(gstAppAmtStr));

            setIsGSTManuallyEdited(manuallySet);

            setSummaryFields({
                totalPackageCost: editData.summary?.totalPackageCost || "",
                discount: editData.summary?.discount || "",
                gstApplicableAmount: manuallySet ? gstAppAmtStr : "",
                gstAmount: editData.summary?.gstAmount || "",
                grandTotal: editData.summary?.grandTotal || "",
            });

            setForm({
                customerName: editData.customerName || "",
                address: editData.address || "",
                contactNo: editData.contactNo || "",
                typeOfEvent: editData.eventType || "",
                date: editData.date || "",
                startTime: editData.startTime || "",
                endTime: editData.endTime || "",
                bookedOn: editData.bookedOn || new Date().toISOString().split("T")[0],
            });

            const eventType = (editData.eventType || "").toLowerCase();
            let defaultList = [];

            if (eventType === "engagement") defaultList = engagementServices;
            else if (eventType === "wedding") defaultList = weddingServices;
            else defaultList = defaultServices;

            const savedServices = editData.services || [];
            const savedServiceNames = savedServices.map(s => s.name);

            const merged = [
                ...savedServices.map(s => ({
                    ...s,
                    royaltyPercent:
                        s.royaltyPercent !== undefined
                            ? s.royaltyPercent
                            : (enableRoyalty ? 30 : 0),
                    royaltyAmount:
                        ((parseFloat(s.total) || 0) *
                            (s.royaltyPercent !== undefined
                                ? s.royaltyPercent
                                : (enableRoyalty ? 30 : 0))) / 100,
                })),
                ...defaultList
                    .filter(name => !savedServiceNames.includes(name))
                    .map(name => ({
                        name,
                        remarks: "",
                        qty: "",
                        rate: "",
                        total: "",
                        royaltyPercent: enableRoyalty ? 30 : 0,
                        royaltyAmount: 0,
                    }))
            ];

            setServices(merged);
            setHasLoadedEditData(true);
        }
    }, [editData, enableRoyalty]);

    const updateWithLog = async (vendorId, newData) => {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
            throw new Error("No logged-in user found");
        }

        // Reference to the vendor document
        const vendorRef = doc(db, "vendor", vendorId);

        // Fetch existing vendor data
        const vendorSnap = await getDoc(vendorRef);
        if (!vendorSnap.exists()) {
            throw new Error("Vendor document does not exist");
        }
        const oldData = vendorSnap.data();

        // Compute changes
        let changes = {};
        for (let key in newData) {
            if (oldData[key] !== newData[key]) {
                changes[key] = { old: oldData[key] || "", new: newData[key] };
            }
        }

        // Fetch current user's info from the top-level usersAccess collection
        const userRef = doc(db, "usersAccess", currentUser.email);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const logId = `updateLog_${Date.now()}`;
        const logEntry = {
            at: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            by: {
                email: currentUser.email,
                name: userData.name || "Unknown User"
            },
            changes
        };

        // Update the vendor document with new data + log entry
        await updateDoc(vendorRef, {
            ...newData,
            [logId]: logEntry
        });
    };

    const handleSave = async () => {
        const newErrors = {};
        if (!form.customerName.trim()) newErrors.customerName = "Name is required.";
        if (!form.contactNo.trim()) newErrors.contactNo = "Contact No. is required.";
        if (!form.date) newErrors.date = "Date is required.";
        if (!form.startTime) newErrors.startTime = "Start Time is required.";
        if (!form.endTime) newErrors.endTime = "End Time is required.";
        if (!form.address.trim()) newErrors.address = "Address is required.";
        if (!form.typeOfEvent && !customEvent.trim()) newErrors.typeOfEvent = "Event Type is required.";

        if (Object.keys(newErrors).length > 0) {
            setFormErrors(newErrors);
            setShowValidationPopup(true);
            setTimeout(() => setShowValidationPopup(false), 3000);
            return;
        }

        setIsSaving(true);

        const filteredServicesToSave = services.filter(srv =>
            (srv.name?.toString().trim() || "") !== "" &&
            ((srv.total?.toString().trim() || "") !== "" || (srv.remarks?.toString().trim() || "") !== "")
        );

        try {
            let slNo = null;

            // ✅ Transaction ensures atomic increment
            await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, "settings", "slCounter");
                const counterSnap = await transaction.get(counterRef);

                if (!counterSnap.exists()) {
                    throw new Error("⚠️ Counter document not found!");
                }

                let current = Number(counterSnap.data().globalEvents ?? 0);
                slNo = current; // use current value
                transaction.update(counterRef, { globalEvents: current + 1 }); // increment
            });

            const vendorData = {
                ...form,
                eventType: customEvent.trim() || form.typeOfEvent,
                services: filteredServicesToSave,
                summary: summaryFields,
                slNo, // ✅ Save serial number
            };

            if (editData && editData.id && editData.source === "vendor") {
                await updateWithLog(editData.id, {
                    ...vendorData,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addDoc(collection(db, "vendor"), {
                    ...vendorData,
                    createdAt: serverTimestamp()
                });
            }

            navigate(-1);
        } catch (error) {
            console.error("❌ Error saving vendor data:", error);
            alert("❌ Failed to save vendor booking.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.vendorWrapper}>
            <div style={{ marginBottom: '30px' }}>
                <BackButton />
            </div>

            <h4 className={styles.vendorHeader}>Global Events & Wedding Planner</h4>
            <p className={styles.vendorSubheader}>
                Bazar Samiti Main Road, Maghdesiya Colony, Patna - 800016<br />
                📞 8084161122 | 📧 vishaldemon448@gmail.com
            </p>

            {showValidationPopup && (
                <div className={styles.topPopup}>⚠️ Please fill all the required fields</div>
            )}

            <div className={styles.formSection}>
                <label>Name:</label>
                <input
                    name="customerName"
                    value={form.customerName || ""}
                    onChange={handleChange}
                />
                {formErrors.customerName && <p className={styles.errorMsg}>{formErrors.customerName}</p>}

                <label>Contact No.:</label>
                <input name="contactNo" value={form.contactNo} onChange={handleChange} />
                {formErrors.contactNo && <p className={styles.errorMsg}>{formErrors.contactNo}</p>}

                <label>Date Of Event:</label>
                <input name="date" type="date" value={form.date} onChange={handleChange} />
                {formErrors.date && <p className={styles.errorMsg}>{formErrors.date}</p>}

                <label>Start Time:</label>
                <input name="startTime" type="time" value={form.startTime} onChange={handleChange} />
                {formErrors.startTime && <p className={styles.errorMsg}>{formErrors.startTime}</p>}

                <label>End Time:</label>
                <input name="endTime" type="time" value={form.endTime} onChange={handleChange} />
                {formErrors.endTime && <p className={styles.errorMsg}>{formErrors.endTime}</p>}

                <label>Booked On :</label>
                <input
                    type="date"
                    name="bookedOn"
                    value={form.bookedOn}
                    onChange={handleChange}
                />

                <label>Address:</label>
                <input name="address" value={form.address} onChange={handleChange} />
                {formErrors.address && <p className={styles.errorMsg}>{formErrors.address}</p>}

                <label>Event Type:</label>
                <button onClick={() => setShowEventPopup(true)} className={styles.vendorPopupBtn}>
                    🎉 {customEvent || form.typeOfEvent || 'Select Event Type'}
                </button>
                {formErrors.typeOfEvent && <p className={styles.errorMsg}>{formErrors.typeOfEvent}</p>}
            </div>

            <div style={{ margin: "15px 0" }}>
                <label>
                    <input
                        type="checkbox"
                        checked={enableRoyalty}
                        onChange={(e) => {
                            setEnableRoyalty(e.target.checked);
                            setServices((prev) =>
                                prev.map((srv) => {
                                    const percent = e.target.checked
                                        ? (srv.royaltyPercent && srv.royaltyPercent !== 0 ? srv.royaltyPercent : 30)
                                        : 0;

                                    return {
                                        ...srv,
                                        royaltyPercent: percent,
                                        royaltyAmount: ((parseFloat(srv.total) || 0) * percent) / 100,
                                    };
                                })
                            );

                        }}
                    />
                </label>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table className={styles.vendorTable}>
                    <thead>
                        <tr>
                            <th>Sl.</th>
                            <th>Service</th>
                            <th>Remarks</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Total</th>
                            {enableRoyalty && <th>Royalty %</th>}
                            {enableRoyalty && <th>Royalty Amt</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {services.map((srv, idx) => (
                            <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{srv.name}</td>
                                <td>
                                    <input
                                        type="text"
                                        value={srv.remarks}
                                        onChange={(e) => handleServiceChange(idx, 'remarks', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={srv.qty}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            handleServiceChange(idx, 'qty', val);
                                        }}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={srv.rate}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/[^0-9.]/g, '');
                                            if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                            handleServiceChange(idx, 'rate', val);
                                        }}
                                    />
                                </td>
                                <td>
                                    <input type="text" value={srv.total} readOnly />
                                </td>

                                {enableRoyalty && (
                                    <>
                                        <td>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={srv.royaltyPercent}
                                                onChange={(e) => {
                                                    let val = e.target.value.replace(/[^0-9.]/g, '');
                                                    if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                                    handleServiceChange(idx, 'royaltyPercent', val);
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <input type="text" value={srv.royaltyAmount} readOnly />
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className={styles.customService}>
                <input
                    placeholder="Add new service"
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                />
                <button onClick={addCustomService}>Add</button>
            </div>

            <div className={styles.summaryInputs}>
                <label>Total Package Cost:</label>
                <input type="text" value={summaryFields.totalPackageCost} readOnly />

                <label>Discount:</label>
                <input
                    type="number"
                    value={summaryFields.discount}
                    onChange={(e) => setSummaryFields({ ...summaryFields, discount: e.target.value })}
                />

                <label>GST Applicable Amount:</label>
                <input
                    type="number"
                    value={summaryFields.gstApplicableAmount}
                    onChange={(e) => {
                        const val = e.target.value.trim();
                        setSummaryFields({ ...summaryFields, gstApplicableAmount: val });
                        setIsGSTManuallyEdited(true);
                    }}
                />

                <label>GST (18%):</label>
                <input type="text" value={summaryFields.gstAmount} readOnly />

                <label>Grand Total:</label>
                <input type="text" value={summaryFields.grandTotal} readOnly />
            </div>

            <button
                onClick={handleSave}
                className={styles.saveBtn}
                disabled={isSaving}
            >
                {isSaving
                    ? editData
                        ? "🔄 Updating..."
                        : "💾 Saving..."
                    : editData
                        ? "🛠 Update"
                        : "💾 Save"}
            </button>

            {showEventPopup && (
                <div className={styles.popupOverlay} onClick={() => setShowEventPopup(false)}>
                    <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.popupHeader}>
                            <div style={{ right: "10px", position: 'fixed' }}>
                                <button style={{ backgroundColor: 'red', borderRadius: '12px' }} onClick={() => setShowEventPopup(false)}>X</button>
                            </div>
                            <h3>Select or Add Event Type</h3>
                            <input
                                type="text"
                                placeholder="🔎 Search event"
                                value={eventSearchQuery}
                                onChange={(e) => setEventSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className={styles.popupList}>
                            {predefinedEvents
                                .filter((event) =>
                                    event.toLowerCase().includes(eventSearchQuery.toLowerCase())
                                )
                                .map((event, i) => (
                                    <div
                                        key={i}
                                        className={styles.popupItem}
                                        onClick={() => {
                                            setForm({ ...form, typeOfEvent: event });
                                            setCustomEvent('');
                                            setShowEventPopup(false);
                                        }}
                                    >
                                        {event}
                                    </div>
                                ))}
                        </div>
                        <div className={styles.popupCustomEvent}>
                            <input
                                placeholder="Or enter custom event"
                                value={customEvent}
                                onKeyDown={handleCustomEventEnter}
                                onChange={(e) => {
                                    setCustomEvent(e.target.value);
                                    setForm({ ...form, typeOfEvent: '' });
                                }}
                            />
                            <button onClick={() => setShowEventPopup(false)} disabled={!customEvent.trim()}>
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vendor;