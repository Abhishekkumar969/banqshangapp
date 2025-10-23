import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Tbody = ({ leads, isEditing, editing, handleFieldChange, handleEdit, handleDateChange, startEdit, moveLeadToDrop, handlePrint }) => {
    const [localValue, setLocalValue] = useState({});
    const [tempFollowUps, setTempFollowUps] = useState({});
    const [modalData, setModalData] = useState(null);

    const headerStyle = { textAlign: "center", border: "2px solid #ffffffff", padding: "2px", fontSize: '13px', fontWeight: '700', color: 'white' };
    const cellStyle = { padding: "2px 6px", border: "2px solid #ffffffff" };

    const handleDropClick = async (lead) => {
        const reason = window.prompt("Enter drop reason for this lead:");
        if (!reason) return;

        if (!lead.enquiryDate) {
            alert("Lead has no enquiryDate!");
            return;
        }

        const date = new Date(lead.enquiryDate);
        if (isNaN(date)) {
            alert("Invalid enquiryDate!");
            return;
        }

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthYear = `${monthNames[date.getMonth()]}${date.getFullYear()}`;

        await moveLeadToDrop(lead.id, true, reason, monthYear);
    };

    const closeModal = () => setModalData(null);

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

        // Convert to IST
        const utc = d.getTime() + d.getTimezoneOffset() * 60000;
        const ist = new Date(utc + 5.5 * 60 * 60 * 1000); // Add 5 hours 30 mins

        const day = String(ist.getDate()).padStart(2, "0");
        const month = String(ist.getMonth() + 1).padStart(2, "0");
        const year = ist.getFullYear();

        return `${day}-${month}-${year}`; // DD-MM-YYYY
    };

    return (
        <>
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

                        <td> {lead.enquiryDate ? formatDate(lead.enquiryDate) : '-'} </td>

                        <td>
                            {lead.functionDate
                                ? (() => {
                                    const date = new Date(lead.functionDate);
                                    if (isNaN(date)) return '';
                                    const monthNames = [
                                        "January", "February", "March", "April", "May", "June",
                                        "July", "August", "September", "October", "November", "December"
                                    ];
                                    return monthNames[date.getMonth()]; // getMonth() gives 0-based index
                                })()
                                : ''
                            }
                        </td>


                        {['functionType', 'dayNight', 'venueType'].map(field => (
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

                        <td key={`${lead.id}-menu-details`} style={{ flexDirection: 'column', gap: '5px' }}>
                            {lead.selectedMenus ? (
                                <>
                                    <table
                                        style={{
                                            borderCollapse: 'collapse',
                                            width: '100%',
                                            whiteSpace: 'nowrap',
                                            border: '2px solid #000000ff',
                                        }}
                                    >
                                        <thead>
                                            <tr>
                                                <th style={headerStyle}>Menu Name</th>
                                                <th style={headerStyle}>PAX</th>
                                                <th style={headerStyle}>Extra Plates</th>
                                                <th style={headerStyle}>Rate</th>
                                                <th style={headerStyle}>Menu Items</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {Object.entries(lead.selectedMenus).map(([menuName, menuData], idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{ whiteSpace: "nowrap" }}
                                                    className={getColumnColorClass(lead.winProbability)}
                                                >
                                                    <td style={cellStyle}>{menuName}</td>
                                                    <td style={cellStyle}>{menuData.noOfPlates}</td>
                                                    <td style={cellStyle}>{menuData.extraPlates}</td>
                                                    <td style={cellStyle}>₹{menuData.rate}</td>
                                                    <td style={cellStyle}>
                                                        {menuData.selectedSubItems && menuData.selectedSubItems.length > 0 ? (
                                                            <button
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    backgroundColor: '#4dd219ff',
                                                                    borderRadius: 4,
                                                                    cursor: 'pointer',
                                                                    color: 'black'
                                                                }}
                                                                onClick={() => setModalData(menuData.selectedSubItems)}
                                                            >
                                                                View Items ({menuData.selectedSubItems.length})
                                                            </button>
                                                        ) : (
                                                            ""
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                    </table>


                                </>
                            ) : (
                                ""
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
                                                        fontSize: '12',
                                                        whiteSpace: 'nowrap',
                                                        border: "2px solid #ffffffff",
                                                    }}
                                                >
                                                    <thead>
                                                        <tr>
                                                            <th
                                                                colSpan={7}
                                                                style={{
                                                                    textAlign: 'left', border: '2px solid rgb(255, 255, 255)', padding: '2px 12px', fontSize: '13px', fontWeight: '700', color: 'white'
                                                                }}
                                                            >
                                                                {dayName} (
                                                                {dayData.date
                                                                    ? (() => {
                                                                        // Use formatDate() — which already returns "DD-MM-YYYY" in IST
                                                                        const formatted = formatDate(dayData.date);
                                                                        return formatted;
                                                                    })()
                                                                    : "No date"}
                                                                )
                                                            </th>
                                                        </tr>
                                                        <tr>
                                                            <th style={{ textAlign: 'center', border: '2px solid rgb(255, 255, 255)', padding: '2px', fontSize: '13px', fontWeight: '700', color: 'white' }}>Meal</th>
                                                            <th style={{ textAlign: 'center', border: '2px solid rgb(255, 255, 255)', padding: '2px', fontSize: '13px', fontWeight: '700', color: 'white' }}>Option</th>
                                                            <th style={{ textAlign: 'center', border: '2px solid rgb(255, 255, 255)', padding: '2px', fontSize: '13px', fontWeight: '700', color: 'white' }}>Time</th>
                                                            <th style={{ textAlign: 'center', border: '2px solid rgb(255, 255, 255)', padding: '2px', fontSize: '13px', fontWeight: '700', color: 'white' }}>PAX</th>
                                                            <th style={{ textAlign: 'center', border: '2px solid rgb(255, 255, 255)', padding: '2px', fontSize: '13px', fontWeight: '700', color: 'white' }}>Extra Plates</th>
                                                            <th style={{ textAlign: 'center', border: '2px solid rgb(255, 255, 255)', padding: '2px', fontSize: '13px', fontWeight: '700', color: 'white' }}>Rate</th>
                                                            <th style={{ textAlign: 'center', border: '2px solid rgb(255, 255, 255)', padding: '2px', fontSize: '13px', fontWeight: '700', color: 'white' }}>Menu</th>









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
                                                                            {mealInfo.pax}
                                                                        </td>

                                                                        <td style={{ padding: "5px 10px", border: "2px solid #ffffffff", whiteSpace: 'nowrap' }}>
                                                                            {mealInfo.extraPlates}
                                                                        </td>

                                                                        <td style={{ padding: "5px 10px", border: "2px solid #ffffffff", whiteSpace: 'nowrap' }}>
                                                                            ₹{mealInfo.rate}
                                                                        </td>

                                                                        <td style={cellStyle}>
                                                                            {mealInfo.selectedItems && mealInfo.selectedItems.length > 0 ? (
                                                                                <button
                                                                                    style={{
                                                                                        padding: '2px 6px',
                                                                                        fontSize: '12px',
                                                                                        backgroundColor: '#4dd219ff',
                                                                                        color: 'black',
                                                                                        borderRadius: 4,
                                                                                        cursor: 'pointer'
                                                                                    }}
                                                                                    onClick={() => setModalData(mealInfo.selectedItems)}
                                                                                >
                                                                                    View Items ({mealInfo.selectedItems.length})
                                                                                </button>
                                                                            ) : ""}
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
                                ₹{lead[field] ?? '-'}
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
                                        `₹${summary.grandTotal}`
                                    )
                                    .join(', ')
                                : '-'}
                        </td>

                        <td> <button onClick={() => sendToUpdate(lead)} style={{ backgroundColor: "#2e76cc", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "4px" }}> Update </button> </td>
                        <td> <button onClick={() => sendToBookings(lead)} style={{ backgroundColor: "#2ecc71", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "4px", whiteSpace: 'nowrap' }}> Book Now </button> </td>
                        <td> <button onClick={() => handlePrint(lead)} style={{ backgroundColor: "#00725c", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "4px" }}> Print </button> </td>

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
                                    ? formatDate(lead.holdDate)
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
                                                <div>{formatDate(followUp.date)}</div>
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

                        {/* Drop Button */}
                        <td>
                            <button
                                style={{
                                    backgroundColor: "#fb4747ff",
                                    color: "white",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    border:'2px solid white',
                                    boxShadow:'2px 2px 4px #030303ff'
                                }}
                                onClick={() => handleDropClick(lead)}
                            >
                                Drop
                            </button>
                        </td>

                    </tr>
                ))}
            </tbody>

            {modalData && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        animation: 'fadeIn 0.4s ease-in-out',
                        padding: "30px",
                        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                        borderRadius: "12px",
                        minHeight: "70vh",
                        background: "transparent",
                        backgroundImage: "url('https://www.transparenttextures.com/patterns/food.png')",
                        backgroundRepeat: "repeat",
                        backgroundSize: "container",
                        backdropFilter: "blur(6px)"
                    }}
                    onClick={closeModal}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            padding: '20px 25px',
                            borderRadius: '12px',
                            minWidth: '250px',
                            maxWidth: '500px',
                            maxHeight: '80%',
                            overflowY: 'auto',
                            boxShadow: '0 8px 20px rgba(245, 108, 4, 0.3)',
                            transform: 'scale(1)',
                            transition: 'transform 0.5s ease-in-out',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '15px'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: '700',
                                color: '#333'
                            }}>Menu Items</h3>

                            <button
                                onClick={closeModal}
                                style={{
                                    background: 'transparent',
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    color: '#ee0606ff',
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* ✅ Remove duplicates before rendering */}
                        <ul style={{
                            paddingLeft: '20px',
                            margin: 0,
                            listStyleType: 'disc',
                            color: '#555'
                        }}>
                            {[...new Set(modalData)].map((item, idx) => (
                                <li key={idx} style={{ marginBottom: '6px' }}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

        </>
    );
};

export default Tbody;