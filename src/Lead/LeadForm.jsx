import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import CalendarInput from '../pages/CalendarInput';
import FunctionTypeSelector from './FunctionTypeSelector';

const LeadForm = forwardRef(({ form, handleChange, setForm }, ref) => {
    const [showCalendar, setShowCalendar] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!form.enquiryDate) {
            const today = new Date();
            const year = today.getUTCFullYear();
            const month = String(today.getUTCMonth() + 1).padStart(2, '0');
            const day = String(today.getUTCDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;

            setForm(prev => ({ ...prev, enquiryDate: formattedDate }));
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
            setForm(prev => ({
                ...prev,
                strikeHallCharges: "700000",
            }));
        }
    }, [form.strikeHallCharges, setForm]);


    return (
        <>

            <div
                style={{
                    position: "absolute",
                    top: "60px",
                    right: "30px",
                    zIndex: 999,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    backgroundColor: "rgba(255, 255, 255, 0)",
                }}
            >
                <input
                    type="date"
                    name="enquiryDate"
                    value={form.enquiryDate}
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
                        placeholder=""
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

            <div className="form-group">
                <label>Contact Number 1</label>
                <input
                    type="tel"
                    name="mobile1"
                    placeholder=""
                    onChange={handleChange}
                    value={form.mobile1 || ''}
                    maxLength={14}
                    pattern="[0-9]{10}"
                />
                {errors.mobile1 && <span className="error">Required</span>}
            </div>

            <div className="form-group">
                <label>Contact Number 2</label>
                <input
                    type="tel"
                    name="mobile2"
                    placeholder=""
                    onChange={handleChange}
                    value={form.mobile2 || ''}
                    maxLength={14}
                    pattern="[0-9]{10}"
                />
            </div>

            <div className="form-group">
                <label>Source of Lead</label>
                <select
                    name="source"
                    onChange={handleChange}
                    value={form.source || ''}
                >
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
                        placeholder=""
                    />
                    {errors.referredBy && <span className="error">Required</span>}
                </div>
            )}

            <div className="form-group">
                <label>Venue Type</label>
                <select
                    name="venueType"
                    onChange={handleChange}
                    value={form.venueType || ''}
                >
                    <option value=""></option>
                    <option value="Hall with Front Lawn">Hall with Front Lawn</option>
                    <option value="Hall with Front & Back Lawn">Hall with Front & Back Lawn</option>
                    <option value="Pool Side">Pool Side</option>
                </select>
                {errors.venueType && <span className="error">Required</span>}
            </div>

            <div className="form-group">
                <label> Function Type</label>
                <FunctionTypeSelector
                    selectedType={form.functionType}
                    setForm={setForm}
                />
                {errors.functionType && <span className="error">Required</span>}

            </div>

            <div className="form-group">
                <label>Day / Night</label>
                <select
                    name="dayNight"
                    value={form.dayNight || ""}
                    onChange={handleChange}
                >
                    <option value="Night">Night</option>
                    <option value="Day">Day</option>
                    <option value="Both">Both</option>
                </select>
            </div>

            <div className="form-group">
                <label>No. of Pax</label>
                <input
                    type="text"
                    name="noOfPlates"
                    placeholder=""
                    value={form.noOfPlates || ""}
                    onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^0-9]/g, "");
                        handleChange({ target: { name: "noOfPlates", value: onlyNums } });
                    }}
                    inputMode="numeric"
                />
                {errors.noOfPlates && <span className="error">Required</span>}
            </div>


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
                        color: 'black'
                    }}
                >
                    {form.functionDate
                        ? `📅 ${form.functionDate.split("-").reverse().join("-")}` // dd-mm-yyyy
                        : "."}

                </button>

                <CalendarInput
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    onDateSelect={(selectedDate) => {
                        // yaha selectedDate ek string hai: "yyyy-mm-dd"
                        setForm((prev) => ({ ...prev, functionDate: selectedDate }));
                        setShowCalendar(false);
                    }}
                    selectedDate={form.functionDate} // string pass karo
                />

                {errors.functionDate && <span className="error">Required</span>}

            </div >

            <div className="form-group">
                <label style={{ whiteSpace: 'nowrap' }}>Strike Venue Charges</label>
                <input
                    type="text"
                    inputMode="decimal"
                    name="strikeHallCharges"
                    value={form.strikeHallCharges || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) {
                            val = val.slice(0, -1);
                        }
                        handleChange({
                            target: {
                                name: "strikeHallCharges",
                                value: val,
                            }
                        });
                    }}
                />
            </div>

            <div className="form-group">
                <label>1. Venue Charges</label>
                <input
                    type="text"
                    inputMode="decimal"
                    name="hallCharges"
                    placeholder=""
                    value={form.hallCharges || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, ""); // only numbers & dot
                        // Prevent multiple dots
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        setForm(prev => ({ ...prev, hallCharges: val })); // ✅ directly update state
                    }}
                />
                {errors.hallCharges && <span className="error">Required</span>}
            </div>

        </>
    );
});

export default LeadForm;
