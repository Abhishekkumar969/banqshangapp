import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import CalendarInput from '../pages/CalendarInput';
import FunctionTypeSelector from './FunctionTypeSelector';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig"; // adjust path if your firebaseConfig is elsewhere

const LeadForm = forwardRef(({ form, handleChange, setForm }, ref) => {
    const [showCalendar, setShowCalendar] = useState(false);
    const [errors, setErrors] = useState({});
    const [venueOptions, setVenueOptions] = useState([]);

    // ✅ Helper to get today's date in IST format (YYYY-MM-DD)
    const getTodayIST = () => {
        const now = new Date();
        const istOffset = 5 * 60 + 30; // minutes
        const istDate = new Date(now.getTime() + istOffset * 60 * 1000);
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const year = istDate.getUTCFullYear();
        return `${year}-${month}-${day}`;
    };

    // ✅ Format a date (yyyy-mm-dd) to DD-MM-YYYY for display
    const formatDateIST = (dateStr) => {
        if (!dateStr) return "-";
        const [year, month, day] = dateStr.split("-");
        return `${day}-${month}-${year}`;
    };

    // ✅ Set default enquiryDate to today IST
    useEffect(() => {
        if (!form.enquiryDate) {
            setForm(prev => ({ ...prev, enquiryDate: getTodayIST() }));
        }
    }, [form.enquiryDate, setForm]);

    useImperativeHandle(ref, () => ({
        validateForm: () => {
            const requiredFields = [
                'name', 'mobile1', 'source',
                'venueType', 'functionType', 'noOfPlates',
                'enquiryDate', 'functionDate', 'hallCharges'
            ];
            const newErrors = {};
            requiredFields.forEach(field => {
                if (!form[field]) newErrors[field] = true;
            });
            setErrors(newErrors);
            return Object.keys(newErrors).length === 0;
        }
    }));

    useEffect(() => {
        if (!form.strikeHallCharges) {
            setForm(prev => ({ ...prev, strikeHallCharges: "700000" }));
        }
    }, [form.strikeHallCharges, setForm]);

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
                            let value = e.target.value;
                            value = value.replace(/\b\w/g, (char) => char.toUpperCase());
                            handleChange({ target: { name: 'name', value } });
                        }}
                    />
                </div>
                {errors.name && <span className="error">Required</span>}
            </div>

            {/* Contact Numbers */}
            <div className="form-group">
                <label>mobile 1</label>
                <input
                    type="tel"
                    name="mobile1"
                    value={form.mobile1 || ''}
                    onChange={handleChange}
                    maxLength={14}
                    pattern="[0-9]{10}"
                />
                {errors.mobile1 && <span className="error">Required</span>}
            </div>

            <div className="form-group">
                <label>mobile 2</label>
                <input
                    type="tel"
                    name="mobile2"
                    value={form.mobile2 || ''}
                    onChange={handleChange}
                    maxLength={14}
                    pattern="[0-9]{10}"
                />
            </div>

            {/* Source */}
            <div className="form-group">
                <label>Source of Lead</label>
                <select name="source" onChange={handleChange} value={form.source || ''}>
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
                    <input
                        type="text"
                        name="referredBy"
                        value={form.referredBy || ''}
                        onChange={handleChange}
                    />
                    {errors.referredBy && <span className="error">Required</span>}
                </div>
            )}

            {/* Venue Type */}
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


            {/* Function Type */}
            <div className="form-group">
                <label>Function Type</label>
                <FunctionTypeSelector selectedType={form.functionType} setForm={setForm} />
                {errors.functionType && <span className="error">Required</span>}
            </div>

            {/* Day/Night */}
            <div className="form-group">
                <label>Day / Night</label>
                <select name="dayNight" value={form.dayNight || ""} onChange={handleChange}>
                    <option value="Night">Night</option>
                    <option value="Day">Day</option>
                    <option value="Both">Both</option>
                </select>
            </div>

            {/* No. of Pax */}
            <div className="form-group">
                <label>No. of Pax</label>
                <input
                    type="text"
                    name="noOfPlates"
                    value={form.noOfPlates || ""}
                    onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, "");
                        handleChange({ target: { name: "noOfPlates", value: onlyNums } });
                    }}
                    inputMode="numeric"
                />
                {errors.noOfPlates && <span className="error">Required</span>}
            </div>

            {/* Extra Plates Date */}
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
                        alignItems: 'center',
                        justifyContent: 'flex-start',
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

            {/* Strike Venue Charges */}
            <div className="form-group">
                <label style={{ whiteSpace: 'nowrap' }}>Strike Venue Charge</label>
                <input
                    type="text"
                    inputMode="decimal"
                    name="strikeHallCharges"
                    value={form.strikeHallCharges || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        handleChange({ target: { name: "strikeHallCharges", value: val } });
                    }}
                />
            </div>

            {/* Venue Charges */}
            <div className="form-group">
                <label>1. Venue Charge</label>
                <input
                    type="text"
                    inputMode="decimal"
                    name="hallCharges"
                    value={form.hallCharges || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        setForm(prev => ({ ...prev, hallCharges: val }));
                    }}
                />
                {errors.hallCharges && <span className="error">Required</span>}
            </div>

        </>
    );
});

export default LeadForm;
