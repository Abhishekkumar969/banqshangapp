import React, { useState } from 'react';

const Tbody = ({ leads, isEditing, editing, handleFieldChange, handleEdit, handleDateChange, startEdit, moveLeadToDrop }) => {
    const [localValue, setLocalValue] = useState({});

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

    return (
        <tbody>
            {leads.map((lead, index) => (
                <tr key={lead.id} className={getColumnColorClass(lead.winProbability)}>

                    <td style={{ fontWeight: 'bold' }}>{leads.length - index}.</td>

                    {['winProbability', 'functionDate', 'name', 'enquiryDate'].map((field) => (
                        <td
                            style={{
                                whiteSpace: 'nowrap',
                                maxWidth: '180rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                            key={`${lead.id}-${field}`}
                            onDoubleClick={() => startEdit(lead.id, field)}
                        >
                            {isEditing(lead.id, field) ? (
                                <input
                                    key={`${lead.id}-${field}-input`} // ✅ force unmount/remount on field change
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
                                        backgroundColor: 'transparent',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                    autoFocus
                                />
                            ) : (
                                field.includes('Date') && lead[field]
                                    ? new Date(lead[field]).toLocaleDateString('en-GB') // 🔁 Format to DD-MM-YYYY
                                    : (lead[field] ?? '-')
                            )}
                        </td>
                    ))}

                    {['functionDate'].map((field) => (
                        <>
                            {field === 'functionDate' && (
                                <td
                                    key={field + '-month'}
                                >
                                    {lead.functionDate
                                        ? new Date(lead.functionDate).toLocaleString('default', { month: 'long' })
                                        : '-'}
                                </td>
                            )}
                        </>
                    ))}

                    {['functionType', 'mobile1', 'mobile2', 'gstAmount', 'gstAmount'].map(field => (
                        <td key={`${lead.id}-${field}`} onDoubleClick={() => startEdit(lead.id, field)}>
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
                                        backgroundColor: 'transparent',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                />
                            ) : (
                                lead[field] ?? '-'
                            )}
                        </td>
                    ))}

                    <td key={`${lead.id}-bookingAmenities`}
                        onDoubleClick={() => startEdit(lead.id, 'bookingAmenities')}
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
                                    backgroundColor: 'transparent',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                }}
                            />
                        ) : (
                            Array.isArray(lead.bookingAmenities) ? lead.bookingAmenities.join(', ') : '-'
                        )}
                    </td>

                    <td key={`${lead.id}-menu-details`}
                        style={{
                            whiteSpace: 'normal', // allow line breaks
                            maxWidth: '150rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        title={JSON.stringify(lead.selectedMenus)}
                    >
                        {lead.selectedMenus
                            ? Object.entries(lead.selectedMenus)
                                .map(([menuName, data]) =>
                                    `${menuName} (${data.rate} x ${data.qty})`
                                )
                                .map((line, idx) => <div key={idx}>{line}</div>)
                            : '-'}
                    </td>

                    {['hallCharges', 'gstAmount', 'gstBase'].map(field => (
                        <td key={`${lead.id}-${field}`} onDoubleClick={() => startEdit(lead.id, field)}>
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
                                        backgroundColor: 'transparent',
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
                                    `${summary.menuName} ( → ${summary.grandTotal})`
                                )
                                .join(', ')
                            : '-'}
                    </td>

                    <td key={`${lead.id}-holdDate`} onDoubleClick={() => startEdit(lead.id, 'holdDate')}>
                        {isEditing(lead.id, 'holdDate') ? (
                            <input
                                key={`${lead.id}-holdDate-input`}
                                type="date"
                                value={getLocalValue(lead.id, 'holdDate', lead.holdDate || '')}
                                onChange={(e) => handleLocalChange(lead.id, 'holdDate', e.target.value)}
                                onBlur={() => handleBlur(lead.id, 'holdDate')}
                                autoFocus
                                style={{ width: '100%', boxSizing: 'border-box', padding: '4px', fontSize: 'inherit', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '4px', }}
                            />
                        ) : (
                            lead.holdDate
                                ? new Date(lead.holdDate).toLocaleDateString('en-GB')
                                : '-'
                        )}
                    </td>

                    {[0, 1, 2, 3, 4].map(index => (
                        <td key={`${lead.id}-followup-${index}`} onDoubleClick={() => handleEdit(lead.id, index)}>
                            {editing[lead.id]?.[index] ? (
                                <input
                                    key={`${lead.id}-followup-input-${index}`}
                                    type="date"
                                    value={lead.followUpDates?.[index] || ''}
                                    onChange={(e) => handleDateChange(lead.id, index, e.target.value)}
                                    onBlur={(e) => handleDateChange(lead.id, index, e.target.value)}
                                    autoFocus
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '4px', fontSize: 'inherit', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '4px', }}
                                />
                            ) : (
                                lead.followUpDates?.[index]
                                    ? new Date(lead.followUpDates[index]).toLocaleDateString('en-GB')
                                    : '-'
                            )}
                        </td>
                    ))}

                    {['source', 'dropReason'].map(field => (
                        <td key={`${lead.id}-${field}`} onDoubleClick={() => startEdit(lead.id, field)} style={{ minWidth: '250px' }}>
                            {isEditing(lead.id, field) ? (
                                <input
                                    key={`${lead.id}-${field}-input`}
                                    type={typeof lead[field] === 'number' ? 'number' : 'text'}
                                    value={getLocalValue(lead.id, field, lead[field] || '')}
                                    onChange={(e) => handleLocalChange(lead.id, field, e.target.value)}
                                    onBlur={() => handleBlur(lead.id, field)}
                                    autoFocus
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '4px', fontSize: 'inherit', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '4px', }} />
                            ) : (
                                lead[field] ?? '-'
                            )}
                        </td>
                    ))}

                    <td key={`${lead.id}-delete`}>
                        <button
                            onClick={() => moveLeadToDrop(lead.id, true)}
                            style={{ backgroundColor: "#e74c3c", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "5px", cursor: "pointer" }} >  UnDrop
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
    );
};

export default Tbody;