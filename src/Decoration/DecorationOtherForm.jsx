import React, { useEffect, useState, useCallback } from "react";
import styles from "../styles/Decoration.module.css";
import { useLocation } from "react-router-dom";
import { getDoc, doc, runTransaction, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import BackButton from "../components/BackButton";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";

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
    const [isGSTManuallyEdited, setIsGSTManuallyEdited] = useState(false);
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [summaryFields, setSummaryFields] = useState({ totalPackageCost: "", overAllPackageCost: "", discount: "", gstApplicableAmount: "", gstAmount: "", grandTotal: "", });
    const [enableRoyalty, setEnableRoyalty] = useState(false);
    const [selectAll, setSelectAll] = useState(false);
    const [decoration, setDecoration] = useState(null);
    const [predefinedEvents, setPredefinedEvents] = useState([]);
    const [userAppType, setUserAppType] = useState(null);

    useEffect(() => {
        const fetchUserAppType = async () => {
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                try {
                    const userRef = doc(db, 'usersAccess', user.email);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        setUserAppType(data.accessToApp);
                    }
                } catch (err) {
                    console.error("Error fetching user app type:", err);
                }
            }
        };
        fetchUserAppType();
    }, []);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user?.email) {
                try {
                    const q = query(
                        collection(db, "usersAccess"),
                        where("email", "==", user.email)
                    );
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        const docSnap = snapshot.docs[0];
                        setDecoration({ id: docSnap.id, ...docSnap.data() });
                    }
                } catch (err) {
                    console.error("Error fetching decoration:", err);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const formatDateIST = useCallback((dateInput) => {
        if (!dateInput) return '';

        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

        // IST formatting
        const istDate = new Date(
            date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        );

        const year = istDate.getFullYear();
        const month = String(istDate.getMonth() + 1).padStart(2, '0');
        const day = String(istDate.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }, []);

    useEffect(() => {
        if (decoration) {
            if (decoration.functionTypes?.length > 0) {
                setPredefinedEvents(decoration.functionTypes);
            } else {
                // No function types → navigate to decorationProfile
                setPredefinedEvents(["Not inserted"]);
                alert("⚠️ Please Refresh & fill your Profile first.");
                navigate("/DecorationProfile");
            }
        }
    }, [decoration, navigate]);

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
        if (!decoration) return;

        // Pick which event type to use — custom event overrides dropdown
        const selectedEvent = customEvent || form.typeOfEvent;
        if (!selectedEvent) return;

        // Match event exactly (case-insensitive) from predefinedEvents
        const matchedKey = decoration.functionTypes?.find(
            (evt) => evt.toLowerCase() === selectedEvent.toLowerCase()
        );

        // Get items list from decoration.items
        const eventItems = decoration.items?.[matchedKey] || [];

        // Update services array dynamically based on event
        setServices(
            eventItems.map((name) => ({
                name,
                remarks: "",
                qty: "",
                rate: "",
                total: "",
                venueType: "",
                royaltyPercent: enableRoyalty ? 30 : 0,
                royaltyAmount: 0,
            }))
        );
    }, [form.typeOfEvent, customEvent, decoration, enableRoyalty]);


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
        const totalFromServices = services.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
        const overAllCost = parseFloat(summaryFields.overAllPackageCost) || 0;
        const discount = parseFloat(summaryFields.discount) || 0;
        const baseAmount = overAllCost > 0 ? overAllCost - discount : totalFromServices - discount;

        // ✅ Use GST only if manually edited; otherwise leave blank
        const gstApplicable = isGSTManuallyEdited
            ? parseFloat(summaryFields.gstApplicableAmount) || 0
            : 0;  // do NOT default to baseAmount

        const gstAmount = gstApplicable * 0.18;
        const grandTotal = baseAmount + gstAmount;

        const format = (val) => isNaN(val) ? "" : Number(val.toFixed(2));

        setSummaryFields(prev => ({
            ...prev,
            totalPackageCost: format(overAllCost > 0 ? overAllCost : totalFromServices),
            gstApplicableAmount: isGSTManuallyEdited ? prev.gstApplicableAmount : "", // stays blank if not manual
            gstAmount: format(gstAmount),
            grandTotal: format(grandTotal),
        }));

    }, [services, summaryFields.overAllPackageCost, summaryFields.discount, summaryFields.gstApplicableAmount, isGSTManuallyEdited]);

    useEffect(() => {
        if (!editData || !decoration) return;

        const gstAppAmtRaw = editData.summary?.gstApplicableAmount;
        const gstAppAmtStr = gstAppAmtRaw?.toString().trim();

        // ✅ Only mark as manually edited if GST is non-empty AND non-zero
        const manuallySet = gstAppAmtStr !== "" && gstAppAmtStr !== "0" && !isNaN(parseFloat(gstAppAmtStr));
        setIsGSTManuallyEdited(manuallySet);

        setSummaryFields({
            totalPackageCost: editData.summary?.totalPackageCost || "",
            overAllPackageCost: editData.summary?.overAllPackageCost || "",
            discount: editData.summary?.discount || "",
            // ✅ If GST is empty or "0", leave it blank; otherwise use stored value
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
            banquetName: editData.banquetName || "", // ✅ added this line
            bookedOn: editData.bookedOn || new Date().toISOString().split("T")[0],
        });

        // Services mapping (same as before)
        const eventName = (editData.eventType || "").toLowerCase();
        let eventKey = "";
        if (eventName.includes("engagement")) eventKey = decoration.functionTypes[0] || "";
        else if (eventName.includes("wedding")) eventKey = decoration.functionTypes[1] || "";
        else eventKey = decoration.functionTypes[0] || "";

        const dynamicServices = decoration.items?.[eventKey] || [];
        const savedServices = editData.services || [];
        const savedServiceNames = savedServices.map(s => s.name);

        const merged = [
            ...savedServices.map(s => ({
                ...s,
                royaltyPercent: s.royaltyPercent !== undefined ? s.royaltyPercent : (enableRoyalty ? 30 : 0),
                royaltyAmount: ((parseFloat(s.total) || 0) *
                    (s.royaltyPercent !== undefined ? s.royaltyPercent : (enableRoyalty ? 30 : 0))) / 100,
            })),
            ...dynamicServices
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

    }, [editData, decoration, enableRoyalty]);

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

        try {
            const filteredServicesToSave = services.filter(
                (srv) =>
                    (srv.name?.toString().trim() || "") !== "" &&
                    ((srv.total?.toString().trim() || "") !== "" || (srv.remarks?.toString().trim() || "") !== "")
            );

            const bookedDate = form.bookedOn ? new Date(form.bookedOn) : new Date();
            const istBookedDate = new Date(bookedDate.getTime() + 5.5 * 60 * 60 * 1000); // IST offset
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthYear = `${monthNames[istBookedDate.getMonth()]}${istBookedDate.getFullYear()}`;

            // ✅ Get current user
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("No logged-in user found");

            // ✅ Add user email to the decorationData
            const decorationData = {
                ...form,
                eventType: customEvent.trim() || form.typeOfEvent,
                services: filteredServicesToSave,
                summary: summaryFields,
                updatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
                userEmail: currentUser.email // <-- this line added
            };

            const monthDocRef = doc(db, "decoration", monthYear);

            if (editData && editData.id) {
                // EDIT MODE
                await runTransaction(db, async (transaction) => {
                    const monthSnapTx = await transaction.get(monthDocRef);
                    const oldData = monthSnapTx.exists() ? monthSnapTx.data()[editData.id] || {} : {};

                    const changes = {};
                    for (let key in decorationData) {
                        if (oldData[key] !== decorationData[key]) {
                            changes[key] = { old: oldData[key] || "", new: decorationData[key] };
                        }
                    }

                    const logId = `updateLog_${Date.now()}`;
                    const logEntry = {
                        at: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
                        by: { email: currentUser.email },
                        changes,
                    };

                    transaction.set(
                        monthDocRef,
                        { [editData.id]: { ...decorationData, [logId]: logEntry } },
                        { merge: true }
                    );
                });
            } else {
                // NEW BOOKING
                const newId = crypto.randomUUID();
                let slNo = null;

                await runTransaction(db, async (transaction) => {
                    const counterRef = doc(db, "settings", "slCounter");
                    const counterSnap = await transaction.get(counterRef);

                    if (!counterSnap.exists()) {
                        slNo = 1;
                        transaction.set(counterRef, { globalEvents: slNo });
                    } else {
                        const current = counterSnap.data().globalEvents ?? 0;
                        slNo = current + 1;
                        transaction.update(counterRef, { globalEvents: slNo });
                    }

                    const newDecorationData = {
                        ...decorationData,
                        slNo,
                        createdAt: new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })

                    };

                    transaction.set(
                        monthDocRef,
                        { [newId]: newDecorationData },
                        { merge: true }
                    );
                });

                console.log("✅ New booking saved with slNo:", slNo);
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
        <>
            <form style={{ marginTop: "50px", display: 'flex', justifyContent: 'space-between' }} onSubmit={handleSave}>
                <div></div>
                <div className="BookedOn">
                    <label
                        style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            color: "#333",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Booking on:
                    </label>
                    <input
                        type="date"
                        name="bookedOn"
                        value={form.bookedOn ? formatDateIST(form.bookedOn) : ""}
                        onChange={handleChange}
                        style={{ color: 'red', width: '150px' }}
                    />
                </div>
            </form>


            <div className={styles.decorationWrapper}>
                <div style={{ marginBottom: '30px' }}>
                    <BackButton />
                </div>

                {decoration ? (
                    <>
                        <h4 className={styles.decorationHeader} >
                            {decoration.firmName || "Decoration Firm Name"}
                        </h4>
                        <p className={styles.decorationSubheader}>
                            {decoration.address || "Decoration Address"}<br />
                            📞 {decoration.contactNo || "Contact Number"} | 📧 {decoration.email || "Email"}
                        </p>
                    </>
                ) : (
                    <p className={styles.message}>Loading decoration info...</p>
                )}

                {showValidationPopup && (
                    <div className={styles.topPopup}>⚠️ Please fill all the required fields</div>
                )}

                <div className={styles.formSection}>

                    <label>Name :</label>
                    <input name="customerName" value={form.customerName || ""} onChange={handleChange} />
                    {formErrors.customerName && <p className={styles.errorMsg}>{formErrors.customerName}</p>}

                    <label>Contact No. :</label>
                    <input name="contactNo" value={form.contactNo} onChange={handleChange} />
                    {formErrors.contactNo && <p className={styles.errorMsg}>{formErrors.contactNo}</p>}

                    <label>Date Of Event :</label>
                    <input name="date" type="date" value={form.date} onChange={handleChange} />
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
                    <input
                        type="date"
                        name="bookedOn"
                        value={form.bookedOn}
                        onChange={handleChange}
                    />

                    <label>Address :</label>
                    <input name="address" value={form.address} onChange={handleChange} />

                    <label>Event Type :</label>
                    <button
                        onClick={() => setShowEventPopup(true)} className={styles.decorationPopupBtn}>
                        🎉 {customEvent || form.typeOfEvent || 'Select Event Type'}
                    </button>
                    {formErrors.typeOfEvent && <p className={styles.errorMsg}>{formErrors.typeOfEvent}</p>}

                    <label>Banquet Name:</label>
                    <input
                        name="banquetName"
                        value={form.banquetName || ""}
                        onChange={handleChange}
                    />
                    {formErrors.banquetName && <p className={styles.errorMsg}>{formErrors.banquetName}</p>}

                    {enableRoyalty && <>
                        <label>Note (PayOut) :</label>
                        <input name="note" value={form.note} onChange={handleChange} /> </>}

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
                            setSummaryFields((prev) => ({
                                ...prev,
                                overAllPackageCost: val
                            }));
                        }}
                    />


                    <label>Calculated Package Cost:</label>
                    <input type="number" value={summaryFields.totalPackageCost} readOnly />

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
                        value={summaryFields.gstApplicableAmount ?? ""}
                        onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9.]/g, "");
                            if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                            setSummaryFields(prev => ({ ...prev, gstApplicableAmount: val }));
                            setIsGSTManuallyEdited(true); // important!
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
                                    .filter(event => event.toLowerCase().includes(eventSearchQuery.toLowerCase()))
                                    .map((event, i) => (
                                        <div
                                            key={i}
                                            className={styles.popupItem}
                                            onClick={() => {
                                                if (event !== "Not inserted") {
                                                    setForm({ ...form, typeOfEvent: event });
                                                    setCustomEvent('');
                                                    setShowEventPopup(false);
                                                }
                                            }}
                                            style={{ cursor: event === "Not inserted" ? "not-allowed" : "pointer", opacity: event === "Not inserted" ? 0.5 : 1 }}
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

            <div style={{ marginBottom: "50px" }}></div>
            <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
        </>
    );

};

export default Decoration;