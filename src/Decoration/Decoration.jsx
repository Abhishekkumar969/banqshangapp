import React, { useEffect, useState } from "react";
import styles from "../styles/Decoration.module.css";
import { useLocation } from "react-router-dom";
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebaseConfig";
import BackButton from "../components/BackButton";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

const engagementServices = [
    "Stage Decoration banquet & Lawn Area",
    "Gate Decoration banquet & Lawn area",
    "passage Decoration banquet & Lawn area",
    "Mandap Decoration banquet & Lawn area ",
    "side walls Decoration banquet & Lawn area ",
    "haldi & Mehandi decoration banquet & Lawn area ",
    "Sangeet Decoration banquet & Lawn area ",
    "Birthday Decoration banquet & Lawn area ",
    "Engagement Decoration banquet & Lawn area ",
    "Tilak Decoration banquet & Lawn area ",
    "Nikha Decoration banquet & Lawn area ",
    "Outdoor Decoration",
];

const weddingServices = [
    "Stage Decoration banquet & Lawn Area",
    "Gate Decoration banquet & Lawn area",
    "passage Decoration banquet & Lawn area",
    "Mandap Decoration banquet & Lawn area ",
    "side walls Decoration banquet & Lawn area ",
    "haldi & Mehandi decoration banquet & Lawn area ",
    "Sangeet Decoration banquet & Lawn area ",
    "Birthday Decoration banquet & Lawn area ",
    "Engagement Decoration banquet & Lawn area ",
    "Tilak Decoration banquet & Lawn area ",
    "Nikha Decoration banquet & Lawn area ",
    "Outdoor Decoration",
];

const defaultServices = [
    "Stage Decoration banquet & Lawn Area",
    "Gate Decoration banquet & Lawn area",
    "passage Decoration banquet & Lawn area",
    "Mandap Decoration banquet & Lawn area ",
    "side walls Decoration banquet & Lawn area ",
    "haldi & Mehandi decoration banquet & Lawn area ",
    "Sangeet Decoration banquet & Lawn area ",
    "Birthday Decoration banquet & Lawn area ",
    "Engagement Decoration banquet & Lawn area ",
    "Tilak Decoration banquet & Lawn area ",
    "Nikha Decoration banquet & Lawn area ",
    "Outdoor Decoration",
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

const Decoration = () => {
    const location = useLocation();
    const [editData, setEditData] = useState(null);
    const [form, setForm] = useState({ customerName: "", venueType: "", address: "", contactNo: "", typeOfEvent: "", date: "", startTime: "", endTime: "", bookedOn: " " });
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
    const [summaryFields, setSummaryFields] = useState({ totalPackageCost: "", overAllPackageCost: "", discount: "", gstApplicableAmount: "", gstAmount: "", grandTotal: "", });
    const [enableRoyalty, setEnableRoyalty] = useState(false);
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        if (location.state?.decorationData) {
            setEditData(location.state.decorationData);
        }
    }, [location.state]);

    const handleCustomEventEnter = (e) => {
        if (e.key === "Enter" && customEvent.trim()) {
            setShowEventPopup(false);
        }
    };

    const handleSelectAll = (checked) => {
        setSelectAll(checked);
        setServices(prev =>
            prev.map(s => ({
                ...s,
                isSelected: checked
            }))
        );
    };

    useEffect(() => {
        if (services.length > 0) {
            const allSelected = services.every(s => s.isSelected);
            if (allSelected !== selectAll) {
                setSelectAll(allSelected);
            }
        }
    }, [services, selectAll]);

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
                        venueType: '',
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

        const overAllPackageCost = parseFloat(summaryFields.overAllPackageCost) || 0;
        const discount = parseFloat(summaryFields.discount) || 0;

        const baseAmount =
            overAllPackageCost > 0
                ? overAllPackageCost - discount
                : total - discount;

        const autoGSTApplicable = baseAmount;

        const manualGSTStr = summaryFields.gstApplicableAmount?.toString().trim();
        const manualGST = parseFloat(manualGSTStr);
        const useManual = isGSTManuallyEdited;

        // ✅ fix here
        const gstApplicable = useManual
            ? (!isNaN(manualGST) && manualGSTStr !== "" ? manualGST : 0)
            : autoGSTApplicable;

        const gstAmount = gstApplicable * 0.18;
        const grandTotal = baseAmount + gstAmount;

        const format = (val) =>
            isNaN(val) || val === ""
                ? ""
                : parseFloat(val) % 1 === 0
                    ? val.toString()
                    : parseFloat(val).toFixed(2);

        setSummaryFields((prev) => ({
            ...prev,
            totalPackageCost:
                overAllPackageCost > 0 ? format(overAllPackageCost) : format(total),
            gstAmount: format(gstAmount),
            grandTotal: format(grandTotal),
            ...(useManual
                ? {}
                : { gstApplicableAmount: format(autoGSTApplicable) }),
        }));
    }, [
        services,
        summaryFields.discount,
        summaryFields.overAllPackageCost,
        summaryFields.gstApplicableAmount,
        isGSTManuallyEdited,
    ]);

    useEffect(() => {
        if (editData) {
            const gstAppAmtRaw = editData.summary?.gstApplicableAmount;
            const gstAppAmtStr = gstAppAmtRaw?.toString().trim();

            const manuallySet = gstAppAmtStr !== "" && gstAppAmtStr !== "0" && !isNaN(parseFloat(gstAppAmtStr));

            setIsGSTManuallyEdited(manuallySet);

            setSummaryFields({
                totalPackageCost: editData.summary?.totalPackageCost || "",
                overAllPackageCost: editData.summary?.overAllPackageCost || "",
                discount: editData.summary?.discount || "",
                gstApplicableAmount: manuallySet ? gstAppAmtStr : "",
                gstAmount: editData.summary?.gstAmount || "",
                grandTotal: editData.summary?.grandTotal || "",
            });

            setForm({
                customerName: editData.customerName || "",
                address: editData.address || "",
                venueType: editData.venueType || "",
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
                        venueType: "",
                        total: "",
                        royaltyPercent: enableRoyalty ? 30 : 0,
                        royaltyAmount: 0,
                    }))
            ];

            setServices(merged);
            setHasLoadedEditData(true);
        }
    }, [editData, enableRoyalty]);

    const updateWithLog = async (decorationId, newData) => {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
            throw new Error("No logged-in user found");
        }

        // Reference to the decoration document
        const decorationRef = doc(db, "decoration", decorationId);

        // Fetch existing decoration data
        const decorationSnap = await getDoc(decorationRef);
        if (!decorationSnap.exists()) {
            throw new Error("decoration document does not exist");
        }
        const oldData = decorationSnap.data();

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

        // Update the decoration document with new data + log entry
        await updateDoc(decorationRef, {
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
        if (!form.typeOfEvent && !customEvent.trim()) newErrors.typeOfEvent = "Event Type is required.";

        if (Object.keys(newErrors).length > 0) {
            setFormErrors(newErrors);
            setShowValidationPopup(true);
            setTimeout(() => setShowValidationPopup(false), 3000);
            return;
        }

        setIsSaving(true);

        const filteredServicesToSave = services.filter(srv =>
            srv.isSelected &&
            (srv.name?.toString().trim() || "") !== "" &&
            ((srv.total?.toString().trim() || "") !== "" || (srv.remarks?.toString().trim() || "") !== "")
        );

        const decorationData = {
            ...form,
            eventType: customEvent.trim() || form.typeOfEvent,
            services: filteredServicesToSave,
            summary: summaryFields,
        };

        try {
            if (editData && editData.id && editData.source === "decoration") {
                // just update, don't touch sl no
                await updateWithLog(editData.id, {
                    ...decorationData,
                    updatedAt: new Date().toISOString()
                });
            } else {
                // 🔹 Transaction to safely increment and fetch counter
                const slCounterRef = doc(db, "settings", "slCounter");

                const newSlNo = await runTransaction(db, async (transaction) => {
                    const slDoc = await transaction.get(slCounterRef);

                    if (!slDoc.exists()) {
                        throw new Error("slCounter document does not exist!");
                    }

                    const current = slDoc.data().decoration ?? 0;
                    const next = current + 1;

                    transaction.update(slCounterRef, { decoration: next });

                    return next;
                });

                // 🔹 Save decoration with Sl No.
                await addDoc(collection(db, "decoration"), {
                    ...decorationData,
                    slNo: newSlNo,
                    createdAt: serverTimestamp()
                });
            }
            navigate(-1);
        } catch (error) {
            console.error("❌ Error saving decoration data:", error);
            alert("❌ Failed to save decoration booking.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.decorationWrapper}>
            <div style={{ marginBottom: '30px' }}>
                <BackButton />
            </div>

            <h4 className={styles.decorationHeader}>Maurya Event</h4>
            <p className={styles.decorationSubheader}>
                Boring Road Harihar Chamber, Patna - 800001<br />
                Mob: 9835320076 | 📧 shivasharma7541@gmail.com
            </p>

            {showValidationPopup && (
                <div className={styles.topPopup}>⚠️ Please fill all the required fields</div>
            )}

            <div className={styles.formSection}>

                <label>Name :</label>
                <input name="customerName" value={form.customerName || ""} onChange={handleChange} disabled />
                {formErrors.customerName && <p className={styles.errorMsg}>{formErrors.customerName}</p>}

                <label>Contact No. :</label>
                <input name="contactNo" value={form.contactNo} onChange={handleChange} />
                {formErrors.contactNo && <p className={styles.errorMsg}>{formErrors.contactNo}</p>}

                <label>Date Of Event :</label>
                <input name="date" type="date" disabled value={form.date} onChange={handleChange} />
                {formErrors.date && <p className={styles.errorMsg}>{formErrors.date}</p>}

                <label>Start Time :</label>
                <input name="startTime" type="time" value={form.startTime} onChange={handleChange} />
                {formErrors.startTime && <p className={styles.errorMsg}>{formErrors.startTime}</p>}

                <label>End Time :</label>
                <input name="endTime" type="time" value={form.endTime} onChange={handleChange} />
                {formErrors.endTime && <p className={styles.errorMsg}>{formErrors.endTime}</p>}

                <label>Venue Type :</label>
                <input name="venueType" value={form.venueType} onChange={handleChange} />

                <label>Booked On :</label>
                <input type="date" name="bookedOn" value={form.bookedOn} onChange={handleChange} />

                <label>Address :</label>
                <input name="address" value={form.address} onChange={handleChange} />

                <label>Event Type :</label>
                <button disabled onClick={() => setShowEventPopup(true)} className={styles.decorationPopupBtn}>
                    🎉 {customEvent || form.typeOfEvent || 'Select Event Type'}
                </button>
                {formErrors.typeOfEvent && <p className={styles.errorMsg}>{formErrors.typeOfEvent}</p>}

                {enableRoyalty && <>
                    <label>Note (PayOut) :</label>
                    <input name="note" value={form.note} onChange={handleChange} /> </>
                }

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
                                        royaltyAmount: ((parseFloat(srv.total) || "") * percent) / 100,
                                    };
                                })
                            );

                        }}
                    />
                </label>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table
                    className={styles.decorationTable}
                    style={{ minWidth: "900px", borderCollapse: "collapse" }} // 👈 min width force
                >
                    <thead>
                        <tr>
                            <th>Sl.</th>
                            <th>
                                <label style={{ whiteSpace: 'nowrap' }}>
                                    Select All <input
                                        type="checkbox"
                                        checked={selectAll}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </label>
                            </th>

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

                                {/* Multiple select checkbox */}
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={srv.isSelected || false}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setServices(prev =>
                                                prev.map((s, i) =>
                                                    i === idx ? { ...s, isSelected: checked } : s
                                                )
                                            );
                                        }}
                                    />
                                </td>

                                {/* Service Name (always read-only) */}
                                <td>{srv.name || "—"}</td>

                                {/* Editable only if selected */}
                                <td>
                                    <input
                                        type="text"
                                        value={srv.remarks || ""}
                                        disabled={!srv.isSelected}   // only editable if selected
                                        onChange={(e) => handleServiceChange(idx, "remarks", e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={srv.qty || ""}
                                        disabled={!srv.isSelected}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            handleServiceChange(idx, "qty", val);
                                        }}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={srv.rate || ""}
                                        disabled={!srv.isSelected}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/[^0-9.]/g, "");
                                            if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                            handleServiceChange(idx, "rate", val);
                                        }}
                                    />
                                </td>
                                <td>
                                    <input type="text" value={srv.total || ""} readOnly />
                                </td>

                                {enableRoyalty && (
                                    <>
                                        <td>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={srv.royaltyPercent || 0}
                                                disabled={!srv.isSelected}
                                                onChange={(e) => {
                                                    let val = e.target.value.replace(/[^0-9.]/g, "");
                                                    if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                                    handleServiceChange(idx, "royaltyPercent", val);
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <input type="text" value={srv.royaltyAmount || ""} readOnly />
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
                <label>OverAll Package Cost:</label>
                <input
                    type="text"
                    inputMode="decimal"
                    value={summaryFields.overAllPackageCost}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        setSummaryFields((prev) => ({ ...prev, overAllPackageCost: val }));
                    }}
                />

                <label>Calculated Package Cost:</label>
                <input type="text" value={summaryFields.totalPackageCost} readOnly />

                <label>Discount:</label>
                <input
                    type="text"
                    inputMode="decimal"
                    value={summaryFields.discount}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        setSummaryFields({ ...summaryFields, discount: val });
                    }}
                />

                <label>GST Applicable Amount:</label>
                <input
                    type="text"
                    inputMode="decimal"
                    value={summaryFields.gstApplicableAmount}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
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

export default Decoration;