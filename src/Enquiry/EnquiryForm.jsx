import React, { useState, useEffect } from "react";
import "../styles/Booking.css";
import CalendarInput from "../pages/CalendarInput";
import { db } from "../firebaseConfig";
import { doc, setDoc, serverTimestamp, collection, deleteField, getDoc } from "firebase/firestore";
import BackButton from "../components/BackButton";
import FunctionTypeSelector from "./FunctionTypeSelector";
import { useLocation } from "react-router-dom";

import { useNavigate } from 'react-router-dom';
import { getAuth } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";

const EnquiryPage = () => {
    const navigate = useNavigate();
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

    const formatDateIST = (date) => {
        if (!date) return "-";

        const d = new Date(date);

        // Convert to IST (UTC + 5:30)
        const istOffset = 5 * 60 + 30; // minutes
        const istDate = new Date(d.getTime() + istOffset * 60 * 1000);

        const day = String(istDate.getUTCDate()).padStart(2, "0");
        const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
        const year = istDate.getUTCFullYear();
        const hours = String(istDate.getUTCHours()).padStart(2, "0");
        const minutes = String(istDate.getUTCMinutes()).padStart(2, "0");

        return `${day}-${month}-${year}, ${hours}:${minutes}`; // DD-MM-YYYY HH:MM IST
    };

    const formatDate = (date) => {
        if (!date) return "-";

        const d = new Date(date);

        // Convert to IST (UTC + 5:30)
        const istOffset = 5 * 60 + 30; // minutes
        const istDate = new Date(d.getTime() + istOffset * 60 * 1000);

        const day = String(istDate.getUTCDate()).padStart(2, "0");
        const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
        const year = istDate.getUTCFullYear();

        return `${day}-${month}-${year}`; // DD-MM-YYYY
    };

    const getTodayIST = () => {
        const now = new Date();
        const istOffset = 5 * 60 + 30; // minutes
        const istDate = new Date(now.getTime() + istOffset * 60 * 1000);

        const day = String(istDate.getUTCDate()).padStart(2, "0");
        const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
        const year = istDate.getUTCFullYear();

        return `${year}-${month}-${day}`; // YYYY-MM-DD
    };

    const location = useLocation();
    const { enquiry } = location.state || {};

    const [formData, setFormData] = useState({
        name: "Guest Name",
        mobile1: "",
        mobile2: "",
        email: "",
        pax: "",
        functionType: "Wedding",
        functionDate: "",
        dayNight: "Night",
        enquiryDate: getTodayIST(),
        shareMedia: { shareMedia: false, at: null },
    });

    useEffect(() => {
        if (location.state) {
            const incoming = location.state;  // your passed enquiry
            const enquiryDateObj = new Date(incoming.enquiryDate);
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const originalMonthYear = `${monthNames[enquiryDateObj.getMonth()]}${enquiryDateObj.getFullYear()}`;

            setFormData({
                ...incoming,
                originalMonthYear,  // store for later comparison
            });
        }
    }, [location.state]);

    const [showCalendar, setShowCalendar] = useState(false);
    const [errors, setErrors] = useState({});
    const [toast, setToast] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const validate = () => {
        const tempErrors = {};
        if (!formData.mobile1) tempErrors.mobile1 = "Mobile 1 is required";
        if (!formData.pax) tempErrors.pax = "Pax is required";
        if (!formData.functionDate) tempErrors.functionDate = "Function Date is required";
        if (!formData.functionType) tempErrors.functionType = "Function Type is required";
        setErrors(tempErrors);
        return Object.keys(tempErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            setToast("❌ Please fill all mandatory fields.");
            setTimeout(() => setToast(null), 5000);
            return;
        }

        try {
            const enquiryDateObj = new Date(formData.enquiryDate);
            if (isNaN(enquiryDateObj)) throw new Error("Invalid enquiry date");

            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const newMonthYear = `${monthNames[enquiryDateObj.getMonth()]}${enquiryDateObj.getFullYear()}`;
            const monthDocRef = doc(db, "enquiry", newMonthYear);

            // 🔹 Determine field ID
            const fieldIdToUse = formData.fieldId || doc(collection(db, "enquiry")).id;

            // 🔹 Delete old month entry if enquiryDate month/year changed
            if (formData.fieldId && formData.originalMonthYear && formData.originalMonthYear !== newMonthYear) {
                const oldMonthRef = doc(db, "enquiry", formData.originalMonthYear);
                await setDoc(oldMonthRef, { [fieldIdToUse]: deleteField() }, { merge: true });
                console.log("🗑️ Deleted old enquiry from:", formData.originalMonthYear);
            }

            // 🔹 Prepare data to save
            const dataToSave = {
                ...formData,
                fieldId: fieldIdToUse,
                originalMonthYear: newMonthYear, // update for future edits
                updatedAt: serverTimestamp(),
                createdAt: formData.fieldId ? formData.createdAt || formatDateIST(new Date()) : formatDateIST(new Date()),
            };

            // 🔹 Save/update enquiry in Firestore
            await setDoc(monthDocRef, { [fieldIdToUse]: dataToSave }, { merge: true });

            setToast(formData.fieldId ? "✅ Enquiry updated successfully!" : "✅ Enquiry submitted successfully!");

            // 🔹 Reset form if new
            if (!formData.fieldId) {
                setFormData({
                    fieldId: "",
                    name: "Guest Name",
                    mobile1: "",
                    mobile2: "",
                    email: "",
                    pax: "",
                    functionType: "",
                    functionDate: "",
                    dayNight: "Night",
                    enquiryDate: getTodayIST(),
                    shareMedia: { shareMedia: false, at: null }, // ✅ updated
                });
            }

            // 🔹 WhatsApp share
            if (formData.shareMedia.shareMedia && formData.mobile1) {
                let phone = formData.mobile1.trim().replace(/\D/g, "");
                if (!phone.startsWith("91")) phone = phone.length === 10 ? "91" + phone : "91" + phone;
                const message = encodeURIComponent("Hello! You can view our gallery here: https://shangrilapalace.com/");
                window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
            }

            setTimeout(() => setToast(null), 4000);
            setTimeout(() => window.history.back(), 1200);

        } catch (error) {
            console.error("❌ Error saving enquiry:", error);
            setToast("❌ Failed to submit enquiry: " + error.message);
            setTimeout(() => setToast(null), 4000);
        }
    };

    return (
        <>
            <div style={{ color: "black" }}>
                <BackButton />

                <form style={{ marginTop: "70px" }} onSubmit={handleSubmit}>
                    <div
                        style={{
                            position: "absolute", top: "60px", right: "30px",
                            zIndex: 999,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        <label
                            style={{
                                fontWeight: 600,
                                fontSize: "14px",
                                color: "#333",
                                whiteSpace: "nowrap",
                                textTransform: 'uppercase'
                            }}
                        >
                            Booking on:
                        </label>
                        <input
                            type="date"
                            name="enquiryDate"
                            value={formData.enquiryDate}
                            onChange={handleChange}
                            style={{
                                padding: "6px 20px",
                                borderRadius: "4px",
                                fontSize: "14px",
                                fontWeight: '600',
                                color: 'red',
                                boxShadow: "1px 1px 2px rgba(111, 111, 111, 1)",
                            }}
                        />
                    </div>
                </form>

                <div className="booking-lead-container">
                    <h2>{enquiry ? "Edit Enquiry" : "New Enquiry"}</h2>
                    <form style={{ marginTop: "0px" }} onSubmit={handleSubmit}>

                        {/* Name */}
                        <div className="form-group">
                            <label>Name:</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} />
                        </div>

                        {/* Mobile 1 */}
                        <div className={`form-group ${errors.mobile1 ? "section-error" : ""}`}>
                            <label>Mobile 1*:</label>
                            <input type="text" name="mobile1" value={formData.mobile1} onChange={handleChange} />
                            {errors.mobile1 && <span className="error">{errors.mobile1}</span>}
                        </div>

                        {/* Mobile 2 */}
                        <div className="form-group">
                            <label>Mobile 2:</label>
                            <input type="text" name="mobile2" value={formData.mobile2} onChange={handleChange} />
                        </div>

                        {/* Email */}
                        <div className="form-group">
                            <label>Email ID:</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} />
                        </div>

                        {/* Pax */}
                        <div className={`form-group ${errors.pax ? "section-error" : ""}`}>
                            <label>Pax*:</label>
                            <input
                                type="text"
                                name="pax"
                                value={formData.pax}
                                onChange={(e) => {
                                    const onlyNums = e.target.value.replace(/[^0-9]/g, ""); // सिर्फ digits allow
                                    handleChange({ target: { name: "pax", value: onlyNums } });
                                }}
                                inputMode="numeric"
                                placeholder=""
                            />
                            {errors.pax && <span className="error">{errors.pax}</span>}
                        </div>

                        {/* Function Type */}
                        <div className="form-group">
                            <label>Function Type*:</label>
                            <FunctionTypeSelector
                                selectedType={formData.functionType}
                                onSelect={(type) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        functionType: type,
                                        // dayNight: typesWithDayNight.includes(type) ? prev.dayNight : "",
                                    }))
                                }
                            />
                            {errors.functionType && <span className="error">{errors.functionType}</span>}
                        </div>

                        {/* Day/Night */}
                        <div className="form-group">
                            <label>Day / Night</label>
                            <select name="dayNight" value={formData.dayNight || ""} onChange={handleChange}>
                                <option value="Night">Night</option>
                                <option value="Day">Day</option>
                                <option value="Both">Both</option>
                            </select>
                        </div>

                        {/* Function Date */}
                        <div className={`form-group ${errors.functionDate ? "section-error" : ""}`}>
                            <label>Function Date*:</label>
                            <button
                                type="button"
                                onClick={() => setShowCalendar(true)}
                                style={{
                                    width: "100%",
                                    borderRadius: "5px",
                                    backgroundColor: "transparent",
                                    border: "1px solid #93939393",
                                    fontSize: '14px',
                                    display: 'flex',
                                    boxShadow: 'inset 2px 2px 5px rgba(255, 255, 255, 0.8), inset -2px -2px 5px #00000045',
                                    color: formData.functionDate ? 'black' : 'white',
                                }}
                            >
                                {formData.functionDate
                                    ? `📅 ${formatDate(formData.functionDate)}`
                                    : "."}
                            </button>

                            <CalendarInput
                                isOpen={showCalendar}
                                onClose={() => setShowCalendar(false)}
                                onDateSelect={(selectedDate) => {
                                    // yaha selectedDate ek string hai: "yyyy-mm-dd"
                                    setFormData((prev) => ({ ...prev, functionDate: selectedDate }));
                                    setShowCalendar(false);
                                }}
                                selectedDate={formData.functionDate} // string pass karo
                            />

                            {errors.functionDate && <span className="error">{errors.functionDate}</span>}
                        </div>

                        {/* Share Media */}
                        <div className="form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    name="shareMedia"
                                    checked={formData.shareMedia.shareMedia} // ✅ fixed
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            shareMedia: {
                                                shareMedia: e.target.checked,
                                                at: e.target.checked ? formatDateIST(new Date()) : null, // ✅ use formatted IST
                                            },
                                        }))
                                    }
                                />
                                Share Media
                            </label>
                        </div>

                        {/* Submit */}
                        <div className="footer-buttons">
                            <button type="submit" className="save-button">
                                {enquiry ? "Update Enquiry" : "Submit Enquiry"}
                            </button>
                        </div>
                    </form>

                    <div style={{ paddingBottom: '60px' }}></div>
                    {toast && (
                        <div className="custom-toast">
                            {toast}
                            <div className="toast-progress"></div>
                        </div>
                    )}
                </div>
            </div>
            <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
        </>
    );
};

export default EnquiryPage;