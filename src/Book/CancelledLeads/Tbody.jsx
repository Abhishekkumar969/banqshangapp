import React, { useState } from 'react';

const Tbody = ({ leads, isEditing, handleFieldChange, handleEdit, startEdit, moveLeadToDrop, handleDelete }) => {
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

    const maxRefundCount = Math.max(...leads.map(lead => lead.refundPayments?.length || 0));

    return (
        <tbody>
            {leads.map((lead, index) => (
                <tr key={lead.id} >

                    <td style={{ fontWeight: 'bold' }}>{leads.length - index}.</td>

                    {['functionDate', 'name', 'enquiryDate'].map((field, index) => (
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

                    {['functionDate'].map((field, index) => (
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

                    {['functionType', 'mobile1', 'mobile2', 'hallCharges', 'gstAmount'].map(field => (
                        <td key={`${lead.id}-${field}`} onDoubleClick={() => startEdit(lead.id, field)}>
                            {isEditing(lead.id, field) ? (
                                <input
                                    key={`${lead.id}-${field}-input`} // ✅ force unmount/remount on edit
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

                    {['totalAmount', 'gstBase'].map(field => (
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

                    <td key={`${lead.id}-menu-names`}
                        style={{
                            whiteSpace: 'nowrap',
                            maxWidth: '150rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        title={JSON.stringify(lead.selectedMenus)}
                    >
                        {lead.selectedMenus
                            ? Object.entries(lead.selectedMenus).map(([name]) => name).join(', ')
                            : '-'}
                    </td>

                    <td key={`${lead.id}-menu-rates`}
                        style={{
                            whiteSpace: 'nowrap',
                            maxWidth: '150rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        title={JSON.stringify(lead.selectedMenus)}
                    >
                        {lead.selectedMenus
                            ? Object.entries(lead.selectedMenus).map(([_, details]) => `₹${details.rate}`).join(', ')
                            : '-'}
                    </td>

                    {['noOfPlates', 'extraPlates', 'grandTotal'].map(field => (
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

                    <td> ₹{lead.advancePayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0} </td>

                    <td style={{
                        fontWeight: 'bold', color: (lead.advancePayments?.reduce((sum, a) => sum + Number(a.amount || 0), 0) -
                            (lead.refundPayments?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0)) === 0 ? 'green' : 'black'
                    }}>
                        ₹{(
                            (lead.refundPayments?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0)).toFixed(2)}
                    </td>


                    {Array.from({ length: maxRefundCount }).map((_, index) => {
                        const adv = lead.refundPayments?.[index];
                        return (
                            <td key={`${lead.id}-refund-${index}`} onDoubleClick={() => handleEdit(lead.id, index)}>
                                {adv ? (
                                    <div>
                                        ₹{adv.amount} via {adv.mode}<br />
                                        <small style={{ color: '#555' }}>
                                            {new Date(adv.addedAt).toLocaleDateString('en-GB')}
                                        </small>
                                    </div>
                                ) : '-'}
                            </td>
                        );
                    })}

                    {['source'].map(field => (
                        <td key={`${lead.id}-${field}`} onDoubleClick={() => startEdit(lead.id, field)}>
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
                            style={{ backgroundColor: "#e74c3c", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }} >  ReStore
                        </button>
                    </td>

                    <td style={{ display: 'none' }} key={`${lead.id}-delete-permanent`}>
                        <button
                            onClick={() => handleDelete(lead.id)}
                            style={{
                                backgroundColor: "#ff4d4d",
                                color: "#fff",
                                border: "none",
                                padding: "5px 10px",
                                borderRadius: "5px",
                                cursor: "pointer"
                            }}
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
    );
};

export default Tbody;