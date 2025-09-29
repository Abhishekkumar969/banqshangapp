import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LogPopupCell from './LogPopupCell';

const Tbody = ({ leads, isEditing, handleFieldChange, startEdit, moveLeadToDrop, sendToPrint, sendToWhatsApp, userPermissions, sortConfig, requestSort }) => {
    const [localValue, setLocalValue] = useState({});
    const navigate = useNavigate();
    const [selectedAdvances, setSelectedAdvances] = useState(null);
    const [modalData, setModalData] = useState(null);

    const headerStyle = { textAlign: "center", border: "2px solid #ffffffff", padding: "2px", fontSize: '13px', fontWeight: '700', color: 'white' };
    const cellStyle = { padding: "2px 6px", border: "2px solid #ffffffff" };

    const closeModal = () => setModalData(null);

    const handleLocalChange = (leadId, field, value) => {
        setLocalValue(prev => ({
            ...prev,
            [leadId]: {
                ...prev[leadId],
                [field]: value
            }
        }));
    };

    const canEdit = (leadId) => {
        if (userPermissions.accessToApp === "A") {
            return true; // Full access
        }

        return (
            userPermissions.editData === "enable" &&
            userPermissions.editablePrebookings.includes(leadId)
        );
    };


    const getLocalValue = (leadId, field, fallback) => {
        return localValue[leadId]?.[field] !== undefined ? localValue[leadId][field] : fallback;
    };

    const sortedLeads = useMemo(() => {
        const sorted = [...leads];
        if (sortConfig.key) {
            sorted.sort((a, b) => {
                const aVal = a[sortConfig.key] ? new Date(a[sortConfig.key]) : new Date(0);
                const bVal = b[sortConfig.key] ? new Date(b[sortConfig.key]) : new Date(0);

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sorted;
    }, [leads, sortConfig]);

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

    const maxAdvanceCount = Math.max(...leads.map(lead => lead.advancePayments?.length || 0));

    const sendToBookings = (lead) => {
        const updatedLead = { ...lead };

        if (localValue[lead.id]) {
            Object.entries(localValue[lead.id]).forEach(([key, value]) => {
                updatedLead[key] = value;
            });
        }

        updatedLead.customItems = lead.customItems || [];
        updatedLead.meals = lead.meals || {};
        updatedLead.selectedMenus = lead.selectedMenus || {};
        updatedLead.advancePayments = lead.advancePayments || [];
        updatedLead.bookingAmenities = lead.bookingAmenities || [];

        navigate('/booking', { state: { leadToEdit: updatedLead } });
    };

    const formatTimeToAMPM = (time24) => {
        const [hour, minute] = time24.split(':').map(Number);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 === 0 ? 12 : hour % 12;
        return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
    };

    const formatAmount = (amount) => {
        if (!amount && amount !== 0) return '-';
        return Math.trunc(Number(amount)).toLocaleString('en-IN');
    };

    const grandTotalSum = leads.reduce((sum, lead) => sum + Number(lead.grandTotal || 0), 0);
    const allAdvancePayments = leads.flatMap(lead => lead.advancePayments || []);
    const advanceSum = allAdvancePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const remainingSum = grandTotalSum - advanceSum;

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year}`;
    };

    return (
        <>
            <thead>
                <tr >
                    <td style={{ backgroundColor: 'white' }} colSpan={10} ></td>

                    {/* Collapsed Hall/GST section */}
                    <td colSpan={3} style={{ textAlign: 'center', color: 'red', backgroundColor: '#61ffeaff', fontWeight: '800', fontSize: '14px' }}>
                        A. Hall Services
                    </td>

                    <td colSpan={2} style={{ textAlign: 'center', backgroundColor: '#fff461ff', color: 'red', fontWeight: '800', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        B. Food Services
                    </td>

                    <td style={{ backgroundColor: 'white' }} colSpan={2} ></td>

                    <td style={{ color: 'black', backgroundColor: '#04ff42ff', fontSize: '15px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                        A+B Total Sales
                    </td>

                    <td style={{ color: 'black', backgroundColor: '#4beefaff', fontSize: '15px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                        Total Advance
                    </td>
                    <td style={{ color: 'black', backgroundColor: '#ff7272ff', fontSize: '15px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                        Total Dues
                    </td>

                    <td colSpan={3} style={{ backgroundColor: 'white' }}  ></td>

                    {Array.from({ length: maxAdvanceCount }).map((_, i) => (
                        <td key={`Advance_Payment_${i + 1}`} style={{ backgroundColor: 'white' }}></td>
                    ))}

                    <td style={{ backgroundColor: 'white' }} colSpan={8} ></td>
                </tr>
            </thead>

            <thead>
                <tr>
                    {['Sl'].map(header => (<th className="sticky sticky-1" key={header}>{header}</th>))}

                    {['Party Name'].map(header => (<th key={header}>{header}</th>))}

                    <th onClick={() => requestSort('enquiryDate')} style={{ cursor: 'pointer' }}>
                        Booked On {sortConfig.key === 'enquiryDate' ? (sortConfig.direction === 'asc' ? "▲" : "▼") : ''}
                    </th>

                    {['Month', 'Venue type', 'Event', 'Day/Night', 'Start Time',
                        'Finish Time', 'Contact Number', 'Hall Charges',
                        'Applied GST', 'GST', 'Menu', 'Meals', 'Sub Total', 'Discount'
                    ].map(header => (
                        <th key={header}>{header}</th>
                    ))}

                    <td style={{ backgroundColor: '#04ff42', color: 'black', fontSize: '14px', fontWeight: '800' }}>
                        ₹{formatAmount(grandTotalSum)}
                    </td>

                    <td style={{ color: 'black', backgroundColor: '#72ffe7ff', fontSize: '14px', fontWeight: '800' }}>
                        ₹{formatAmount(advanceSum)}
                    </td>

                    <td style={{ color: 'black', backgroundColor: '#ff7272ff', fontSize: '14px', fontWeight: '800' }}>
                        ₹{formatAmount(remainingSum)}
                    </td>

                    {['Cash', 'Bank'].map(header => (
                        <th key={header}>{header}</th>
                    ))}

                    {['Source'
                    ].map(header => (
                        <th key={header}>{header}</th>
                    ))}

                    <th style={{ fontSize: '21px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }} >  {'✏️'} </div>
                    </th>

                    <th>
                        <button style={{ backgroundColor: "#66363606", color: "#fff", border: "none", borderRadius: "4px", margin: '0 auto', display: 'flex', padding: '0px', justifyContent: 'center' }}>
                            <img
                                src="../../assets/whatsappp.png"
                                alt=""
                                style={{ width: '28px', height: '28px' }}
                            />
                        </button>
                    </th>

                    <th style={{ fontSize: '21px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }} >  {'🖨️'} </div>
                    </th>

                    <th>
                        <button style={{ backgroundColor: "#66363606", color: "#fff", border: "none", borderRadius: "4px", margin: '0 auto', display: 'flex', padding: '0px', justifyContent: 'center' }}>
                            <img
                                src="../../assets/logs.png"
                                alt=""
                                style={{ width: '28px', height: '28px' }}
                            />
                        </button>
                    </th>

                    {['Note...'].map(header => (
                        <th key={header}>{header}</th>
                    ))}

                    {['Total Refund'].map(header => (
                        <th key={header}>{header}</th>
                    ))}

                    {[
                        'Complimentary Items', 'Chargeable Items', 'Custom Menu Items', ' Event Booked By', 'commission', ''
                    ].map(header => (
                        <th key={header}>{header}</th>
                    ))}
                </tr>
            </thead>

            <tbody>
                {sortedLeads.map((lead, index) => (
                    <tr
                        key={lead.id}
                        style={{
                            whiteSpace: "nowrap",
                            backgroundColor:
                                lead.venueType === "Hall with Front Lawn"
                                    ? "lightgreen"
                                    : lead.venueType === "Pool Side"
                                        ? "#f7ff62ff"
                                        : lead.venueType === "Hall with Front & Back Lawn"
                                            ? "#bce1ffff"
                                            : "white",
                            transition: "all 0.3s ease",
                        }}

                    >
                        <td className="sticky sticky-1" style={{ fontWeight: 'bold' }}>{leads.length - index}.</td>

                        {['name'].map((field, index) => (
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

                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    field === 'name'
                                        ? `${lead.prefix || ''} ${lead.name || '-'}`.trim()
                                        : field.includes('Date') && lead[field]
                                            ? new Date(lead[field]).toLocaleDateString('en-GB')
                                            : (lead[field] ?? '-')
                                )}
                            </td>
                        ))}

                        {['enquiryDate'].map((field, index) => (
                            <td
                                style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontWeight: '700',
                                    padding: '0px 2px 0px 5px',
                                    fontSize: '13px'
                                }}
                                key={`${lead.id}-${field}`}
                            >
                                <>
                                    {field.includes('Date') ? formatDate(lead[field]) : (lead[field] ?? '-')}

                                    {lead.meals &&
                                        (() => {
                                            const funcDate = lead[field] ? formatDate(lead[field]) : null;

                                            const uniqueMealDates = [
                                                ...new Set(
                                                    Object.values(lead.meals)
                                                        .filter(dayData => dayData?.date)
                                                        .map(dayData => formatDate(dayData.date))
                                                ),
                                            ];

                                            return uniqueMealDates
                                                .filter(d => d !== funcDate)
                                                .map((d, i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            color: "brown",
                                                            marginTop: "2px",
                                                        }}
                                                    >
                                                        {d}
                                                    </div>
                                                ));
                                        })()}
                                </>
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

                        {['venueType'].map((field, index) => (
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
                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    field.includes('Date') && lead[field]
                                        ? new Date(lead[field]).toLocaleDateString('en-GB') // 🔁 Format to DD-MM-YYYY
                                        : (
                                            (lead[field] === 'Lawn' || lead[field] === 'Back Lawn')
                                                ? 'Pool Side'
                                                : (lead[field] ?? '-')
                                        )
                                )}
                            </td>
                        ))}

                        {['functionType', 'dayNight'].map((field, index) => (
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

                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    field.includes('Date') && lead[field]
                                        ? new Date(lead[field]).toLocaleDateString('en-GB') // 🔁 Format to DD-MM-YYYY
                                        : (lead[field] ?? '')
                                )}
                            </td>
                        ))}

                        <td key={`${lead.id}-startTime`}>
                            {lead.startTime ? formatTimeToAMPM(lead.startTime) : '-'}
                        </td>

                        <td key={`${lead.id}-finishTime`}>
                            {lead.finishTime ? formatTimeToAMPM(lead.finishTime) : '-'}
                        </td>

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
                                            <span key={`${lead.id}-${field}`}></span>
                                        )
                                    ))}
                                </div>
                            )}
                        </td>

                        {['hallCharges', 'gstBase', 'gstAmount'].map(field => (
                            <td key={`${lead.id}-${field}`}>
                                ₹{isEditing(lead.id, field) ? (
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
                                    lead[field] !== undefined && lead[field] !== null
                                        ? Math.floor(Number(lead[field])).toLocaleString('en-IN')
                                        : '-'
                                )}
                            </td>
                        ))}

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
                                                <th style={headerStyle}>Rate</th>
                                                <th style={headerStyle}>PAX</th>
                                                <th style={headerStyle}>Extra Plates</th>
                                                <th style={headerStyle}>Menu Items</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {Object.entries(lead.selectedMenus).map(([menuName, menuData], idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        whiteSpace: "nowrap",
                                                        backgroundColor:
                                                            lead.venueType === "Lawn" ||
                                                                lead.venueType === "Pool Side" ||
                                                                lead.venueType === "Back Lawn"
                                                                ? "#f7ff62ff"
                                                                : lead.venueType === "Hall with Front & Back Lawn"
                                                                    ? "#bce1ffff"
                                                                    : "lightgreen",
                                                    }}
                                                >
                                                    <td style={cellStyle}>{menuName}</td>
                                                    <td style={cellStyle}>₹{menuData.rate}</td>
                                                    <td style={cellStyle}>{menuData.noOfPlates}</td>
                                                    <td style={cellStyle}>{menuData.extraPlates}</td>
                                                    <td style={cellStyle}>
                                                        {menuData.selectedSubItems && menuData.selectedSubItems.length > 0 ? (
                                                            <button
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    fontSize: '12px',
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
                                        .sort(([a], [b]) => parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10))
                                        .map(([dayName, dayData], dayIdx) => {
                                            const mealOrder = ["Breakfast", "Lunch", "Dinner"];

                                            return (
                                                <table
                                                    key={dayIdx}
                                                    style={{
                                                        borderCollapse: "collapse",
                                                        width: "100%",
                                                        marginTop: "0px",
                                                        whiteSpace: 'nowrap',
                                                        border: "2px solid #000000ff",
                                                    }}
                                                >
                                                    <thead>
                                                        <tr>
                                                            <th colSpan={7} style={{ ...headerStyle, textAlign: "center" }}>
                                                                {dayName} ({dayData.date ? new Date(dayData.date).toLocaleDateString() : "No date"})
                                                            </th>
                                                        </tr>
                                                        <tr>
                                                            <th style={headerStyle}>Meal</th>
                                                            <th style={headerStyle}>Option</th>
                                                            <th style={headerStyle}>Time</th>
                                                            <th style={headerStyle}>PAX</th>
                                                            <th style={headerStyle}>Extra Plates</th>
                                                            <th style={headerStyle}>Rate</th>
                                                            <th style={headerStyle}>Items</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(dayData)
                                                            .filter(([mealName]) => mealName !== "date")
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
                                                                    <tr
                                                                        key={mealIdx}
                                                                        style={{
                                                                            whiteSpace: "nowrap",
                                                                            backgroundColor:
                                                                                lead.venueType === "Lawn" ||
                                                                                    lead.venueType === "Pool Side" ||
                                                                                    lead.venueType === "Back Lawn"
                                                                                    ? "#f7ff62ff"
                                                                                    : lead.venueType === "Hall with Front & Back Lawn"
                                                                                        ? "#bce1ffff"
                                                                                        : "lightgreen",
                                                                        }}
                                                                    >
                                                                        <td style={cellStyle}>{mealName}</td>
                                                                        <td style={cellStyle}>{mealInfo.option}</td>
                                                                        <td style={cellStyle}>{formatTime(mealInfo.startTime)} - {formatTime(mealInfo.endTime)}</td>
                                                                        <td style={cellStyle}>{mealInfo.pax}</td>
                                                                        <td style={cellStyle}>{mealInfo.extraPlates || "0"}</td>
                                                                        <td style={cellStyle}>₹{mealInfo.rate}</td>
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
                            ) : " "}
                        </td>

                        <td key={`${lead.id}-subtotal`}>
                            {lead.selectedMenus || lead.meals
                                ? (() => {
                                    const menuTotal = lead.selectedMenus
                                        ? Object.values(lead.selectedMenus).reduce(
                                            (sum, menu) => sum + (Number(lead.noOfPlates || 0) + Number(lead.extraPlates || 0)) * Number(menu.rate || 0),
                                            0
                                        )
                                        : 0;

                                    const mealsTotal = lead.meals
                                        ? Object.values(lead.meals)
                                            .filter(meal => meal.total)
                                            .reduce((sum, meal) => sum + Number(meal.total), 0)
                                        : 0;

                                    return (menuTotal + mealsTotal).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
                                })()
                                : ''}
                        </td>

                        {['discount'].map(field => (
                            <td key={`${lead.id}-${field}`} >
                                ₹{isEditing(lead.id, field) ? (
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
                                    lead[field] !== undefined && lead[field] !== null
                                        ? Math.floor(Number(lead[field])).toLocaleString('en-IN')
                                        : '0'
                                )}
                            </td>
                        ))}

                        {['grandTotal'].map(field => (
                            <td key={`${lead.id}-${field}`} style={{ backgroundColor: '#04ff42ff', fontWeight: '800' }}>
                                ₹{isEditing(lead.id, field) ? (
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
                                    lead[field] !== undefined && lead[field] !== null
                                        ? Math.floor(Number(lead[field])).toLocaleString('en-IN')
                                        : '-'
                                )}
                            </td>
                        ))}

                        < td >
                            <div>
                                ₹{lead.advancePayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0}
                            </div>
                            <div>
                                <button
                                    style={{
                                        padding: "4px 8px", cursor: "pointer",
                                        background: "linear-gradient(180deg, #2359b6ff, #78a9ffff)",
                                    }}
                                    onClick={() => setSelectedAdvances(lead.advancePayments || [])}
                                >
                                    View Advances
                                </button>
                            </div>
                        </td>

                        <td style={{ color: 'black', backgroundColor: '#ff7272ff' }}>
                            ₹{Math.floor(
                                (Number(lead.grandTotal) || 0) -
                                (lead.advancePayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0) +
                                (lead.refundPayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0)
                            ).toLocaleString('en-IN')}
                        </td>

                        <td>
                            ₹{(
                                lead.advancePayments
                                    ?.filter(adv => adv.mode === "Cash")
                                    .reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0
                            ).toLocaleString("en-IN")}
                        </td>

                        <td>
                            ₹{(
                                lead.advancePayments
                                    ?.filter(adv => adv.mode !== "Cash")
                                    .reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0
                            ).toLocaleString("en-IN")}
                        </td>

                        {['source'].map(field => (
                            <td key={`${lead.id}-${field}`}
                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px' }}
                            >
                                <div>
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
                                </div>

                                {lead.source?.toLowerCase() === 'reference' && (
                                    <div style={{ marginTop: '6px' }} onClick={(e) => {
                                        e.stopPropagation();
                                        startEdit(lead.id, 'referredBy');
                                    }}>
                                        <small style={{ color: '#555' }}>
                                            By: <strong>{lead.referredBy || '—'}</strong>
                                        </small>
                                    </div>
                                )}
                            </td>
                        ))}

                        <td style={{ display: 'none' }} key={`${lead.id}-delete`}>
                            <button
                                onClick={() => moveLeadToDrop(lead.id, true)}
                                style={{ backgroundColor: "#e74c3c", color: "#fff", border: "none", padding: "10px 15px", cursor: "pointer" }} >  Cancel
                            </button>
                        </td>

                        <td>
                            {canEdit(lead.id) ? (
                                <button onClick={() => sendToBookings(lead)} style={{ backgroundColor: "transparent", color: "#fff", border: "none", borderRadius: "4px", margin: '0px' }}>
                                    <div style={{ fontSize: '21px' }} >✏️</div>
                                </button>) : (
                                ''
                            )}
                        </td>

                        <td>
                            <button onClick={() => sendToWhatsApp(lead)} style={{ backgroundColor: "transparent", border: "none", margin: '0px', display: 'flex', justifyContent: 'center' }}>
                                <img
                                    src="../../assets/whatsappp.png"
                                    alt=""
                                    style={{ width: '30px', height: '30px' }}
                                />
                            </button>
                        </td>

                        <td>
                            <button onClick={() => sendToPrint(lead)} style={{ backgroundColor: "transparent", color: "#fff", border: "none", borderRadius: "4px", display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{ fontSize: '21px' }}>🖨️</div>
                            </button>
                        </td>

                        <LogPopupCell lead={lead} />

                        {['note'].map(field => (
                            <td key={`${lead.id}-${field}`}
                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px' }}
                            >
                                <div>
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
                                </div>
                            </td>
                        ))}

                        <td
                            style={{
                                fontWeight: "bold",
                                color:
                                    (lead.advancePayments?.reduce((sum, a) => sum + Number(a.amount || 0), 0) -
                                        (lead.refundPayments?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0)) === 0
                                        ? "green"
                                        : "black",
                            }}
                        >
                            ₹{(
                                lead.refundPayments?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0
                            ).toLocaleString("en-IN")}
                        </td>

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

                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px' }} >
                            {Array.isArray(lead.customItems)
                                ? lead.customItems
                                    .filter(item => item.selected)
                                    .map((item, index) => (
                                        <div key={index}>
                                            {item.name}- @ ₹{item.rate} × {item.qty} = ₹{item.total}
                                        </div>
                                    ))
                                : '-'}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px' }} >
                            {Array.isArray(lead.customMenuCharges)
                                ? lead.customMenuCharges
                                    .filter(item => item.selected)
                                    .map((item, index) => (
                                        <div key={index}>
                                            {item.name}- @ ₹{item.rate} × {item.qty} = ₹{item.total}
                                        </div>
                                    ))
                                : ' '}
                        </td>

                        {['eventBookedBy'].map((field, index) => (
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
                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    field.includes('Date') && lead[field]
                                        ? new Date(lead[field]).toLocaleDateString('en-GB') // 🔁 Format to DD-MM-YYYY
                                        : (
                                            (lead[field] === 'Lawn' || lead[field] === 'Back Lawn')
                                                ? 'Pool Side'
                                                : (lead[field] ?? ' ')
                                        )
                                )}
                            </td>
                        ))}

                        {['commission'].map(field => (
                            <td key={`${lead.id}-${field}`} >
                                ₹{isEditing(lead.id, field) ? (
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
                                    lead[field] !== undefined && lead[field] !== null
                                        ? Math.floor(Number(lead[field])).toLocaleString('en-IN')
                                        : '0'
                                )}
                            </td>
                        ))}

                        <td>{lead.id}</td>

                    </tr >
                ))}

            </tbody >

            {selectedAdvances && (
                <div style={{
                    position: "fixed",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1000,
                    backdropFilter: "blur(6px)"
                }}>
                    <div style={{
                        background: "linear-gradient(135deg, #ffffffcc, #f0f0f0dd)",
                        padding: "25px",
                        borderRadius: "16px",
                        minWidth: "250px",
                        maxHeight: "70vh",
                        overflowY: "auto",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.25), inset 0 2px 8px rgba(255,255,255,0.6)",
                        transform: "scale(1)",
                        animation: "popupFadeIn 0.3s ease-out"
                    }}>
                        <h3 style={{
                            marginBottom: "15px",
                            fontSize: "1.4rem",
                            fontWeight: "bold",
                            color: "#333",
                            textAlign: "center",
                            textShadow: "1px 1px 2px rgba(0,0,0,0.15)"
                        }}>
                            💰 Advance Payments
                        </h3>

                        {selectedAdvances.length > 0 ? (
                            selectedAdvances.map((adv, idx) => (
                                <div key={idx} style={{
                                    marginBottom: "12px",
                                    padding: "10px 14px",
                                    display: 'flex',
                                    borderRadius: "10px",
                                    background: "linear-gradient(135deg,#fdfdfd,#f5f5f5)",
                                    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                                    transition: "transform 0.2s",
                                }}>
                                    <strong style={{ fontSize: "1.1rem", color: "#222" }}>
                                        ₹{formatAmount(adv.amount)}
                                    </strong>
                                    <span style={{ color: "#000000ff" }}>- via {adv.mode}  -</span>
                                    <br />
                                    <span style={{ color: "#000000ff", fontWeight: '600' }}>
                                        {new Date(adv.receiptDate).toLocaleDateString("en-GB")}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p style={{ textAlign: "center", color: "#666" }}>No advance payments</p>
                        )}

                        <button
                            style={{
                                marginTop: "15px",
                                padding: "8px 18px",
                                borderRadius: "8px",
                                border: "none",
                                background: "linear-gradient(135deg, #cb1111ff, #fc25c3ff)",
                                color: "white",
                                fontWeight: "bold",
                                cursor: "pointer",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                transition: "all 0.2s",
                            }}
                            onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
                            onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                            onClick={() => setSelectedAdvances(null)}
                        >
                            Close
                        </button>
                    </div>

                    {/* Animation style */}
                    <style>
                        {`
                @keyframes popupFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `}
                    </style>
                </div>
            )}

            {/* Modal */}
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

                        // 🍽 Custom container background with food texture
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#333' }}>Menu Items</h3>
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
                        <ul style={{ paddingLeft: '20px', margin: 0, listStyleType: 'disc', color: '#555' }}>
                            {modalData.map((item, idx) => (
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