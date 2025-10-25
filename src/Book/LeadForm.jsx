import React, { useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import CalendarInput from '../pages/CalendarInput';
import FunctionTypeSelector from './FunctionTypeSelector';
import { getAuth } from "firebase/auth";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

const LeadForm = forwardRef(({ form, handleChange, setForm }, ref) => {
    const [showCalendar, setShowCalendar] = useState(false);
    const [errors, setErrors] = useState({});
    const auth = getAuth();
    const [venueOptions, setVenueOptions] = useState([]);

    // ---------------------- IST Helpers ----------------------
    const getTodayIST = () => {
        const now = new Date();
        const istOffset = 5 * 60 + 30; // 5:30 hours in minutes
        const istDate = new Date(now.getTime() + istOffset * 60 * 1000);
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const year = istDate.getUTCFullYear();
        return `${year}-${month}-${day}`; // YYYY-MM-DD for <input type="date">
    };

    const formatDateIST = (dateStr) => {
        if (!dateStr) return "-";
        const [year, month, day] = dateStr.split("-");
        return `${day}-${month}-${year}`; // DD-MM-YYYY for display
    };

    // ---------------------- Fetch Current User Name ----------------------
    const fetchUserName = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, "usersAccess"), where("email", "==", user.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            setForm(prev => ({ ...prev, eventBookedBy: userData.name || "" }));
        }
    }, [auth, setForm]);

    useEffect(() => {
        fetchUserName();
    }, [fetchUserName]);

    // ---------------------- Set Default IST Dates & Times ----------------------
    useEffect(() => {
        setForm(prev => ({
            ...prev,
            enquiryDate: prev.enquiryDate || getTodayIST(),
            startTime: prev.startTime || '11:00',
            finishTime: prev.finishTime || '21:00', // 09:00 PM
        }));
    }, [setForm]);

    useEffect(() => {
        const fetchVenueTypes = async () => {
            try {
                const q = query(
                    collection(db, "usersAccess"),
                    where("accessToApp", "==", "A")
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    // assuming you only want the first admin with access "A"
                    const adminData = snapshot.docs[0].data();
                    setVenueOptions(adminData.venueTypes || []);
                }
            } catch (error) {
                console.error("Error fetching venue types:", error);
            }
        };

        fetchVenueTypes();
    }, []);

    // ---------------------- Form Validation ----------------------
    useImperativeHandle(ref, () => ({
        validateForm: () => {
            const newErrors = {};
            if (!form.name) newErrors.name = true;
            if (!form.mobile1) newErrors.mobile1 = true;
            if (!form.source) newErrors.source = true;
            if (!form.venueType) newErrors.venueType = true;
            if (!form.functionType) newErrors.functionType = true;
            if (!form.noOfPlates) newErrors.noOfPlates = true;
            if (!form.enquiryDate) newErrors.enquiryDate = true;
            if (!form.functionDate) newErrors.functionDate = true;
            if (!form.startTime) newErrors.startTime = true;
            if (!form.finishTime) newErrors.finishTime = true;
            if (!form.hallCharges) newErrors.hallCharges = true;
            if (form.source === 'Reference' && !form.referredBy) newErrors.referredBy = true;

            setErrors(newErrors);
            return Object.keys(newErrors).length === 0;
        }
    }));

    return (
        <>
            {/* Customer Name */}
            <div className="form-group">
                <label>Customer Name</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <select
                        onChange={(e) => handleChange({ target: { name: 'prefix', value: e.target.value } })}
                        value={form.prefix || ''}
                        style={{ width: '100px' }}
                    >
                        <option value="Mr.">Mr.</option>
                        <option value="Miss">Miss</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Dr.">Dr.</option>
                        <option value="Md.">Md.</option>
                        <option value="">Blank</option>
                    </select>
                    <input
                        type="text"
                        value={form.name || ''}
                        onChange={(e) => {
                            let value = e.target.value.replace(/\b\w/g, char => char.toUpperCase());
                            handleChange({ target: { name: 'name', value } });
                        }}
                    />
                </div>
                {errors.name && <span className="error">Required</span>}
            </div>

            {/* Contact Numbers */}
            <div className="form-group">
                <label>Mobile 1</label>
                <input
                    type="tel"
                    name="mobile1"
                    value={form.mobile1 || ''}
                    onChange={handleChange}
                    maxLength={14}
                />
                {errors.mobile1 && <span className="error">Required</span>}
            </div>

            <div className="form-group">
                <label>Mobile 2</label>
                <input
                    type="tel"
                    name="mobile2"
                    value={form.mobile2 || ''}
                    onChange={handleChange}
                    maxLength={14}
                />
            </div>

            {/* Email */}
            <div className="form-group">
                <label>Email ID</label>
                <input type="email" name="email" value={form.email || ''} onChange={handleChange} />
            </div>

            {/* Source */}
            <div className="form-group">
                <label>Source of Lead</label>
                <select name="source" value={form.source || ''} onChange={handleChange}>
                    <option value=""></option>
                    <option value="Walk-In">Walk-In</option>
                    <option value="Just Dial">Just Dial</option>
                    <option value="Reference">Reference</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Past Booked">Past Booked</option>
                </select>
                {errors.source && <span className="error">Required</span>}
            </div>

            {form.source === 'Reference' && (
                <div className="form-group">
                    <label>Referred By</label>
                    <input type="text" name="referredBy" value={form.referredBy || ''} onChange={handleChange} />
                    {errors.referredBy && <span className="error">Required</span>}
                </div>
            )}

            {/* Venue & Function Type */}
            <div className="form-group">
                <label>Venue Type</label>
                <select
                    name="venueType"
                    onChange={handleChange}
                    value={form.venueType || ""}
                >
                    <option value=""></option>
                    {venueOptions.map((venue) => (
                        <option key={venue.value || venue} value={venue.value || venue}>
                            {venue.value || venue}
                        </option>
                    ))}
                </select>
                {errors.venueType && <span className="error">Required</span>}
            </div>


            <div className="form-group">
                <label>Function Type</label>
                <FunctionTypeSelector selectedType={form.functionType} setForm={setForm} />
                {errors.functionType && <span className="error">Required</span>}
            </div>

            {/* Day/Night & Pax */}
            <div className="form-group">
                <label>Day / Night</label>
                <select name="dayNight" value={form.dayNight || ""} onChange={handleChange}>
                    <option value="Night">Night</option>
                    <option value="Day">Day</option>
                    <option value="Both">Both</option>
                </select>
            </div>

            <div className="form-group">
                <label>No. of Pax</label>
                <input
                    type="text"
                    inputMode="numeric"
                    name="noOfPlates"
                    value={form.noOfPlates || ""}
                    onChange={(e) => handleChange({ target: { name: "noOfPlates", value: e.target.value.replace(/[^0-9]/g, "") } })}
                />
                {errors.noOfPlates && <span className="error">Required</span>}
            </div>

            <div className="form-group">
                <label>Extra Plate</label>
                <input
                    type="text"
                    inputMode="numeric"
                    name="extraPlates"
                    value={form.extraPlates || ""}
                    onChange={(e) => handleChange({ target: { name: "extraPlates", value: e.target.value.replace(/[^0-9]/g, "") } })}
                />
            </div>

            {/* Function Date */}
            <div className="form-group">
                <label>Date of Function</label>
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
                        color: form.functionDate ? 'black' : 'white',
                    }}
                >
                    {form.functionDate ? `📅 ${formatDateIST(form.functionDate)}` : "."}
                </button>

                <CalendarInput
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    onDateSelect={(selectedDate) => {
                        setForm(prev => ({ ...prev, functionDate: selectedDate }));
                        setShowCalendar(false);
                    }}
                    selectedDate={form.functionDate}
                />
                {errors.functionDate && <span className="error">Required</span>}
            </div>

            {/* Start & Finish Time */}
            <div className="form-group">
                <label>Start Time</label>
                <input type="time" name="startTime" value={form.startTime || ''} onChange={handleChange} />
                {errors.startTime && <span className="error">Required</span>}
            </div>

            <div className="form-group">
                <label>Finish Time</label>
                <input type="time" name="finishTime" value={form.finishTime || ''} onChange={handleChange} />
                {errors.finishTime && <span className="error">Required</span>}
            </div>

            {/* Event Booked By */}
            <div className="form-group" style={{ display: 'none' }}>
                <label>Event Booked By</label>
                <input type="text" name="eventBookedBy" value={form.eventBookedBy || ''} readOnly />
            </div>

            {/* Hall Charges */}
            <div className="form-group">
                <label>1. Hall Charges</label>
                <input
                    type="text"
                    inputMode="decimal"
                    name="hallCharges"
                    value={form.hallCharges || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        handleChange({ target: { name: "hallCharges", value: val } });
                    }}
                />
                {errors.hallCharges && <span className="error">Required</span>}
            </div>

            {/* Note */}
            <div className="form-group">
                <label>Note:</label>
                <input type="text" name="note" value={form.note || ''} onChange={handleChange} />
            </div>
        </>
    );
});

export default LeadForm;
