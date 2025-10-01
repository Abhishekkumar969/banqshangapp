import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Tbody = ({ leads, isEditing, editing, handleFieldChange, handleEdit, handleDateChange, startEdit, moveLeadToDrop, handlePrint }) => {
    const [localValue, setLocalValue] = useState({});
    const [showDropReasonFor, setShowDropReasonFor] = useState(null);
    const [dropReason, setDropReason] = useState('');
    const [tempFollowUps, setTempFollowUps] = useState({});

    const getTempFollowUp = (leadId, index) => {
        return tempFollowUps[`${leadId}_${index}`] || {};
    };

    const setTempFollowUp = (leadId, index, data) => {
        setTempFollowUps(prev => ({
            ...prev,
            [`${leadId}_${index}`]: {
                ...prev[`${leadId}_${index}`],
                ...data
            }
        }));
    };

    const handleLocalChange = (leadId, field, value) => {
        setLocalValue(prev => ({
            ...prev,
            [leadId]: {
                ...prev[leadId],
                [field]: value
            }
        }));
    };

    const getLocalValue = (leadId, field, fallback) => {
        return localValue[leadId]?.[field] !== undefined ? localValue[leadId][field] : fallback;
    };

    const handleBlur = (leadId, field) => {
        const value = localValue[leadId]?.[field];
        if (value !== undefined) {
            handleFieldChange(leadId, field, value);
            setLocalValue(prev => {
                const updated = { ...prev };
                if (updated[leadId]) {
                    delete updated[leadId][field];
                    if (Object.keys(updated[leadId]).length === 0) {
                        delete updated[leadId];
                    }
                }
                return updated;
            });
        }
    };

    const getColumnColorClass = (value) => {
        const prob = parseFloat(value);
        if (isNaN(prob)) return '';
        if (prob < 25) return 'low-prob';
        if (prob < 50) return 'medium-prob';
        if (prob < 75) return 'high-prob';
        return 'very-high-prob';
    };

    const navigate = useNavigate();

    const sendToBookings = (lead) => {
        navigate('/booking', {
            state: {
                leadToEdit: lead,
                sourceDoc: lead.monthYear  // pass the monthYear too
            }
        });
    };

    const sendToUpdate = (lead) => {
        navigate('/bookinglead', {
            state: {
                leadToEdit: lead,
                isUpdateMode: true
            }
        });
    };

    const formatDate = (date) => {
        if (!date) return "-";
        const d = new Date(date);

        // Always UTC (no timezone shift)
        const day = String(d.getUTCDate()).padStart(2, "0");
        const month = String(d.getUTCMonth() + 1).padStart(2, "0");
        const year = d.getUTCFullYear();

        return `${day}-${month}-${year}`; // DD-MM-YYYY
    };

    return (
        <tbody>
            {leads.map((lead, index) => (
                <tr key={lead.id} className={getColumnColorClass(lead.winProbability)}>

                    <td style={{ fontWeight: 'bold' }}>{leads.length - index}.</td>


                    {['name'].map((field) => (
                        <td
                            style={{
                                whiteSpace: 'nowrap',
                                maxWidth: '180rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                            key={`${lead.id}-${field}`}
                        >
                            {isEditing(lead.id, field) ? (
                                <input
                                    key={`${lead.id}-${field}-input`} // ✅ force remount
                                    type={field.includes('Date') ? 'date' : 'text'}
                                    value={getLocalValue(lead.id, field, lead[field] || '')}
                                    onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                    onBlur={() => {
                                        handleBlur(lead.id, field);
                                        setTimeout(() => startEdit(null, null), 0); // ✅ exit edit mode
                                    }}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '7px',
                                        fontSize: 'inherit',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                    autoFocus
                                />
                            ) : (
                                field === 'name'
                                    ? `${lead.prefix || ''} ${lead.name || '-'}`.trim()
                                    : field.includes('Date') && lead[field]
                                        ? formatDate(lead[field]) // 🔁 Format to DD-MM-YYYY
                                        : (lead[field] ?? '-')
                            )}
                        </td>
                    ))}

                    <td>
                        {lead.enquiryDate ? formatDate(lead.enquiryDate) : '-'}
                    </td>

                    <td>
                        {lead.functionDate ? (() => {
                            const dateObj = new Date(lead.functionDate);
                            if (isNaN(dateObj)) return '';
                            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                            return `${monthNames[dateObj.getMonth()]}${dateObj.getFullYear()}`;
                        })() : ''}
                    </td>


                    {['functionType','dayNight', 'venueType' ].map(field => (
                        <td key={`${lead.id}-${field}`}>
                            {isEditing(lead.id, field) ? (
                                <input
                                    type={typeof lead[field] === 'number' ? 'number' : 'text'}
                                    value={getLocalValue(lead.id, field, lead[field] || '')}
                                    onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                    onBlur={() => handleBlur(lead.id, field)}
                                    autoFocus
                                    style={{
                                        whiteSpace: 'nowrap',
                                        maxWidth: '180rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        whiteSpace: 'nowrap',
                                        maxWidth: '180rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {lead[field] ?? '-'}
                                </div>
                            )}
                        </td>
                    ))}

                    <td key={`${lead.id}-mobiles`}>
                        {isEditing(lead.id, 'mobile') ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {['mobile1', 'mobile2'].map((field) => (
                                    <input
                                        key={`${lead.id}-${field}-input`}
                                        type="text"
                                        value={getLocalValue(lead.id, field, lead[field] || '')}
                                        onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                        onBlur={() => handleBlur(lead.id, field)}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '4px',
                                            fontSize: 'inherit',

                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {['mobile1', 'mobile2'].map((field, idx) => (
                                    lead[field] ? (
                                        <span
                                            key={`${lead.id}-${field}`}
                                            onClick={() => {
                                                const confirmed = window.confirm(
                                                    `📞 Call ${lead.name || 'this person'} (${lead.functionType || 'Unknown Role'})?`
                                                );
                                                if (confirmed) {
                                                    window.location.href = `tel:${lead[field]}`;
                                                }
                                            }}
                                            style={{
                                                color: 'black',
                                                textDecoration: 'none',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                margin: '3px 0px'
                                            }}
                                        >
                                            <span role="img" aria-label="call"></span> {lead[field]}
                                        </span>
                                    ) : (
                                        <span key={`${lead.id}-${field}`}>-</span>
                                    )
                                ))}
                            </div>
                        )}
                    </td>

                    <td key={`${lead.id}-menu-details`} style={{ padding: '0px', flexDirection: 'column', gap: '5px' }}>
                        {lead.selectedMenus ? (
                            <table
                                style={{
                                    borderCollapse: 'collapse',
                                    width: '100%',
                                    whiteSpace: 'nowrap',
                                    border: '2px solid #ffffffff',
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th style={{ padding: '5px 10px', border: '2px solid #ffffffff', textAlign: 'left', backgroundColor: 'orange !important' }}>Menu Name</th>
                                        <th style={{ padding: '5px 10px', border: '2px solid #ffffffff', textAlign: 'left', backgroundColor: 'orange !important' }}>Rate</th>
                                        <th style={{ padding: '5px 10px', border: '2px solid #ffffffff', textAlign: 'left', backgroundColor: 'orange !important' }}>PAX</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {Object.entries(lead.selectedMenus).map(([menuName, data], idx) => (
                                        <tr key={idx} className={getColumnColorClass(lead.winProbability)}>
                                            <td style={{ padding: '5px 10px', border: '2px solid #ffffffff' }}>{menuName}</td>
                                            <td style={{ padding: '5px 10px', border: '2px solid #ffffffff' }}>₹{data.rate}</td>
                                            <td style={{ padding: '5px 10px', border: '2px solid #ffffffff' }}>{data.qty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            "-"
                        )}
                    </td>

                    <td key={`${lead.id}-meals`}>
                        {lead.meals ? (
                            <>
                                {Object.entries(lead.meals)
                                    .filter(([_, dayData]) =>
                                        Object.entries(dayData).some(
                                            ([mealName, mealInfo]) => mealName !== "date" && mealInfo?.total
                                        )
                                    )
                                    .sort(([a], [b]) => {
                                        const numA = parseInt(a.replace(/\D/g, ""), 10);
                                        const numB = parseInt(b.replace(/\D/g, ""), 10);
                                        return numA - numB;
                                    })
                                    .map(([dayName, dayData], dayIdx) => {
                                        const mealOrder = ["Breakfast", "Lunch", "Dinner"]; // ✅ fixed order

                                        return (
                                            <table
                                                key={dayIdx}
                                                style={{
                                                    borderCollapse: "collapse",
                                                    width: "100%",
                                                    marginTop: "0px",
                                                    whiteSpace: 'nowrap',
                                                    border: "2px solid #ffffffff",
                                                }}
                                            >
                                                <thead>
                                                    <tr>
                                                        <th
                                                            colSpan={4}
                                                            style={{
                                                                textAlign: "left",
                                                                padding: "2px 10px",
                                                                border: "1px solid #ccc",
                                                            }}
                                                        >
                                                            {dayName} (
                                                            {dayData.date
                                                                ? (() => {
                                                                    const d = new Date(dayData.date);
                                                                    const day = String(d.getDate()).padStart(2, "0");
                                                                    const month = String(d.getMonth() + 1).padStart(2, "0");
                                                                    const year = d.getFullYear();
                                                                    return `${day}-${month}-${year}`;
                                                                })()
                                                                : "No date"}
                                                            )
                                                        </th>
                                                    </tr>
                                                    <tr>
                                                        <th style={{ padding: "2px 10px", border: "2px solid #ffffffff" }}>Meal</th>
                                                        <th style={{ padding: "2px 10px", border: "2px solid #ffffffff" }}>Option</th>
                                                        <th style={{ padding: "2px 10px", border: "2px solid #ffffffff" }}>Time</th>
                                                        <th style={{ padding: "2px 10px", border: "2px solid #ffffffff" }}>PAX x Rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(dayData)
                                                        .filter(([mealName]) => mealName !== "date")
                                                        // ✅ sort by defined order
                                                        .sort(([mealA], [mealB]) => {
                                                            const idxA = mealOrder.indexOf(mealA);
                                                            const idxB = mealOrder.indexOf(mealB);
                                                            if (idxA === -1 && idxB === -1) return mealA.localeCompare(mealB);
                                                            if (idxA === -1) return 1;
                                                            if (idxB === -1) return -1;
                                                            return idxA - idxB;
                                                        })
                                                        .map(([mealName, mealInfo], mealIdx) => {
                                                            const formatTime = (timeStr) => {
                                                                if (!timeStr) return "";
                                                                let [hour, minute] = timeStr.split(":").map(Number);
                                                                const ampm = hour >= 12 ? "PM" : "AM";
                                                                hour = hour % 12 || 12;
                                                                return `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;
                                                            };

                                                            return (
                                                                <tr key={mealIdx} className={getColumnColorClass(lead.winProbability)}>
                                                                    <td style={{ padding: "5px 10px", border: "2px solid #ffffffff", whiteSpace: 'nowrap' }}>
                                                                        {mealName}
                                                                    </td>
                                                                    <td style={{ padding: "5px 10px", border: "2px solid #ffffffff", whiteSpace: 'nowrap' }}>
                                                                        {mealInfo.option}
                                                                    </td>
                                                                    <td style={{ padding: "5px 10px", border: "2px solid #ffffffff", whiteSpace: 'nowrap' }}>
                                                                        {formatTime(mealInfo.startTime)} - {formatTime(mealInfo.endTime)}
                                                                    </td>
                                                                    <td style={{ padding: "5px 10px", border: "2px solid #ffffffff", whiteSpace: 'nowrap' }}>
                                                                        {mealInfo.pax} (PAX) x ₹{mealInfo.rate}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                </tbody>
                                            </table>
                                        );
                                    })}
                            </>
                        ) : (
                            " "
                        )}
                    </td>

                    {['hallCharges', 'gstAmount', 'gstBase'].map(field => (
                        <td key={`${lead.id}-${field}`} >
                            {isEditing(lead.id, field) ? (
                                <input
                                    key={`${lead.id}-${field}-input`}
                                    type={typeof lead[field] === 'number' ? 'number' : 'text'}
                                    value={getLocalValue(lead.id, field, lead[field] || '')}
                                    onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                    onBlur={() => handleBlur(lead.id, field)}
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '4px',
                                        fontSize: 'inherit',

                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                />
                            ) : (
                                lead[field] ?? '-'
                            )}
                        </td>
                    ))}

                    <td key={`${lead.id}-menu-grandTotal`}
                        style={{
                            whiteSpace: 'nowrap',
                            maxWidth: '150rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        title={JSON.stringify(lead.menuSummaries)}
                    >
                        {Array.isArray(lead.menuSummaries)
                            ? lead.menuSummaries
                                .map((summary) =>
                                    `${summary.menuName} (→${summary.grandTotal})`
                                )
                                .join(', ')
                            : '-'}
                    </td>

                    <td > <button onClick={() => sendToUpdate(lead)} style={{ backgroundColor: "#2e76cc", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "4px" }}> Update </button> </td>
                    <td> <button onClick={() => sendToBookings(lead)} style={{ backgroundColor: "#2ecc71", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "4px", whiteSpace: 'nowrap' }}> Book Now </button> </td>
                    <td><button onClick={() => handlePrint(lead)} style={{ backgroundColor: "#00725c", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "4px" }}> Print </button> </td>

                    <td key={`${lead.id}-bookingAmenities`}
                        title={Array.isArray(lead.bookingAmenities) ? lead.bookingAmenities.join(', ') : ''}
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px' }}
                    >
                        {isEditing(lead.id, 'bookingAmenities') ? (
                            <input
                                key={`${lead.id}-bookingAmenities-input`}
                                type="text"
                                value={Array.isArray(getLocalValue(lead.id, 'bookingAmenities', lead.bookingAmenities))
                                    ? getLocalValue(lead.id, 'bookingAmenities', lead.bookingAmenities).join(', ')
                                    : ''}
                                onChange={(e) =>
                                    handleLocalChange(
                                        lead.id,
                                        'bookingAmenities',
                                        e.target.value.split(',').map(item => item.trim())
                                    )
                                }
                                onBlur={() => handleBlur(lead.id, 'bookingAmenities')}
                                autoFocus
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '4px',
                                    fontSize: 'inherit',

                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                }}
                            />
                        ) : (
                            Array.isArray(lead.bookingAmenities) ? lead.bookingAmenities.join(', ') : '-'
                        )}
                    </td>

                    {['winProbability'].map(field => (
                        <td key={`${lead.id}-${field}`} onClick={() => startEdit(lead.id, field)}>
                            {isEditing(lead.id, field) ? (
                                <input
                                    key={`${lead.id}-${field}-input`}
                                    type="text"
                                    placeholder="Win Probability"
                                    value={getLocalValue(lead.id, field, lead[field] || '')}
                                    onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                    onBlur={() => handleBlur(lead.id, field)}
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '4px',
                                        fontSize: 'inherit',

                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                />
                            ) : (
                                <div>{lead[field] ?? '-'}</div>
                            )}
                        </td>
                    ))}

                    <td key={`${lead.id}-holdDate`} onClick={() => startEdit(lead.id, 'holdDate')}>
                        {isEditing(lead.id, 'holdDate') ? (
                            <input
                                key={`${lead.id}-holdDate-input`}
                                type="date"
                                value={getLocalValue(lead.id, 'holdDate', lead.holdDate || '')}
                                onChange={(e) => handleLocalChange(lead.id, 'holdDate', e.target.value)}
                                onBlur={() => handleBlur(lead.id, 'holdDate')}
                                autoFocus
                                style={{ width: '100%', boxSizing: 'border-box', padding: '4px', fontSize: 'inherit', border: '1px solid #ccc', borderRadius: '4px', }}
                            />
                        ) : (
                            lead.holdDate
                                ? new Date(lead.holdDate).toLocaleDateString('en-GB')
                                : '-'
                        )}
                    </td>

                    {[0, 1, 2, 3, 4].map(index => {
                        const followUp = lead.followUpDetails?.[index] || {};
                        const isActive = editing[lead.id]?.[index];

                        return (
                            <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '6000rem' }} key={`${lead.id}-followup-${index}`} onClick={() => handleEdit(lead.id, index)}>
                                {isActive ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <input
                                            type="date"
                                            value={getTempFollowUp(lead.id, index).date || followUp.date || ''}
                                            onChange={(e) =>
                                                setTempFollowUp(lead.id, index, { date: e.target.value })
                                            }
                                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Enter remark"
                                            value={getTempFollowUp(lead.id, index).remark || followUp.remark || ''}
                                            onChange={(e) =>
                                                setTempFollowUp(lead.id, index, { remark: e.target.value })
                                            }
                                            onBlur={() => {
                                                const update = {
                                                    ...followUp,
                                                    ...getTempFollowUp(lead.id, index)
                                                };
                                                if (update.date || update.remark) {
                                                    handleDateChange(lead.id, index, update);
                                                }
                                            }}

                                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        />
                                    </div>
                                ) : (
                                    followUp.date ? (
                                        <>
                                            <div>{new Date(followUp.date).toLocaleDateString('en-GB')}</div>
                                            {followUp.remark && <small style={{ color: 'black' }}>Remark: {followUp.remark}</small>}
                                        </>
                                    ) : '-'
                                )}
                            </td>
                        );
                    })}

                    {['source',].map(field => (
                        <td key={`${lead.id}-${field}`} >
                            {isEditing(lead.id, field) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <input
                                        key={`${lead.id}-${field}-input`}
                                        type="text"
                                        placeholder="Source"
                                        value={getLocalValue(lead.id, field, lead[field] || '')}
                                        onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                        onBlur={() => handleBlur(lead.id, field)}
                                        autoFocus
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '4px',
                                            fontSize: 'inherit',

                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                        }}
                                    />
                                    <input
                                        key={`${lead.id}-referredBy-input`}
                                        type="text"
                                        placeholder="Reference (Optional)"
                                        value={getLocalValue(lead.id, 'referredBy', lead.referredBy || '')}
                                        onChange={(e) => handleLocalChange(lead.id, 'referredBy', e.target.value)}
                                        onBlur={() => handleBlur(lead.id, 'referredBy')}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '4px',
                                            fontSize: 'inherit',

                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                        }}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <div>{lead[field] ?? '-'}</div>
                                    {lead.referredBy && (
                                        <div style={{ fontSize: '0.85em', color: '#888' }}>
                                            • Reference: {lead.referredBy}
                                        </div>
                                    )}
                                </div>
                            )}
                        </td>
                    ))}

                    {['authorisedSignatory'].map(field => (
                        <td key={`${lead.id}-${field}`} >
                            {isEditing(lead.id, field) ? (
                                <input
                                    key={`${lead.id}-${field}-input`}
                                    type={typeof lead[field] === 'number' ? 'number' : 'text'}
                                    value={getLocalValue(lead.id, field, lead[field] || '')}
                                    onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                    onBlur={() => handleBlur(lead.id, field)}
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '4px',
                                        fontSize: 'inherit',

                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                />
                            ) : (
                                lead[field] ?? '-'
                            )}
                        </td>
                    ))}

                    <td key={`${lead.id}-delete`}>
                        {showDropReasonFor === lead.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <textarea
                                    placeholder="Enter reason to drop"
                                    value={dropReason}
                                    onChange={(e) => setDropReason(e.target.value)}
                                    style={{
                                        padding: '6px',
                                        borderRadius: '4px',
                                        border: '1px solid #ccc',
                                        resize: 'none',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button
                                        onClick={() => {
                                            if (dropReason.trim()) {
                                                moveLeadToDrop(lead.id, true, dropReason); // pass reason
                                                setShowDropReasonFor(null);
                                                setDropReason('');
                                            } else {
                                                alert("Please enter a reason.");
                                            }
                                        }}
                                        style={{ backgroundColor: '#e74c3c', color: '#fff', padding: '6px 10px', border: 'none', borderRadius: '4px' }}
                                    >
                                        Confirm Drop
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDropReasonFor(null);
                                            setDropReason('');
                                        }}
                                        style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowDropReasonFor(lead.id)}
                                style={{ backgroundColor: "#e74c3c", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "5px", cursor: "pointer" }}
                            >
                                Drop
                            </button>
                        )}
                    </td>

                </tr>
            ))}
        </tbody>
    );
};

export default Tbody;