import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import './BookingLeadsTable.css';
import Tbody from './Tbody';
import BackButton from "../../components/BackButton";
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const BookingLeadsTable = () => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [editingField, setEditingField] = useState({});
    const [editing, setEditing] = useState({});
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [searchTerm, setSearchTerm] = useState("");
    const [sortDirection, setSortDirection] = useState('asc');
    const [userPermissions, setUserPermissions] = useState({ editData: "disable", editablePrebookings: [], accessToApp: '' });
    const [filteredLeads, setFilteredLeads] = useState(leads);
    const [availableFY, setAvailableFY] = useState([]);
    const [filterType, setFilterType] = useState("all");
    const [venueFilter, setVenueFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState({ key: 'functionDate', direction: 'desc' });
    const [financialYear, setFinancialYear] = useState("");

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedLeads = useMemo(() => {
        const sorted = [...filteredLeads];
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
    }, [filteredLeads, sortConfig]);

    useEffect(() => {
        if (leads.length > 0) {
            const fyList = leads.map(l => {
                const d = new Date(l.functionDate);
                const y = d.getFullYear();
                const m = d.getMonth();

                return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
            });

            const currentFY = getCurrentFinancialYear();
            const uniqueFY = [...new Set([...fyList, currentFY])].sort();

            setAvailableFY(uniqueFY);
        }
    }, [leads]);

    useEffect(() => {
        const fetchUserPermissions = async () => {
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                try {
                    const userRef = doc(db, "usersAccess", user.email);
                    const userSnap = await getDoc(userRef); // ✅ single fetch
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        setUserPermissions({
                            editData: data.editData || "disable",
                            editablePrebookings: data.editablePrebookings || [],
                            accessToApp: data.accessToApp || "",
                        });

                    }
                } catch (err) {
                    console.error("Error fetching user permissions:", err);
                }
            }
        };

        fetchUserPermissions();
    }, []);

    useEffect(() => {
        let filtered = [...leads];
        if (fromDate) filtered = filtered.filter(lead => new Date(lead.functionDate) >= new Date(fromDate));
        if (toDate) filtered = filtered.filter(lead => new Date(lead.functionDate) <= new Date(toDate));

        if (financialYear && financialYear !== "") {
            const [startYear, endYear] = financialYear.split("-").map(Number);
            const fyStart = new Date(startYear, 3, 1);
            const fyEnd = new Date(endYear, 2, 31);
            filtered = filtered.filter(lead => {
                const date = new Date(lead.functionDate);
                return date >= fyStart && date <= fyEnd;
            });
        }

        if (venueFilter !== "all") {
            filtered = filtered.filter(lead => lead.venueType === venueFilter);
        }

        setFilteredLeads(filtered);
    }, [fromDate, toDate, financialYear, leads, venueFilter]);

    const getCurrentFinancialYear = () => {
        const today = new Date();
        const year = today.getUTCFullYear();
        const month = today.getUTCMonth() + 1;
        if (month >= 4) {
            return `${year}-${year + 1}`;
        } else {
            return `${year - 1}-${year}`;
        }
    };

    useEffect(() => {
        if (availableFY.length > 0 && financialYear === null) {
            setFinancialYear(getCurrentFinancialYear());
        }
    }, [availableFY, financialYear]);

    const moveLeadToDrop = async (leadId, removeOriginal = false) => {
        try {
            const leadRef = doc(db, 'prebookings', leadId);
            const leadSnap = await getDoc(leadRef);

            if (!leadSnap.exists()) {
                console.error('Lead not found:', leadId);
                return;
            }

            const leadData = leadSnap.data();

            const dropRef = doc(db, 'cancelledBookings', leadId);
            await setDoc(dropRef, {
                ...leadData,
                droppedAt: new Date()
            });

            if (removeOriginal) {
                await deleteDoc(leadRef);

                // 🔥 Remove from local state
                setLeads(prev => prev.filter(l => l.id !== leadId));
                setFilteredLeads(prev => prev.filter(l => l.id !== leadId));
            }

            console.log(`Lead ${leadId} moved to dropLeads`);
        } catch (error) {
            console.error('Error moving lead to dropLeads:', error);
        }
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "prebookings"), (querySnapshot) => {
            let allBookings = [];

            querySnapshot.docs.forEach((docSnap) => {
                const monthYear = docSnap.id; // e.g. "Sep2025"
                const bookingsMap = docSnap.data(); // map of bookings

                // Flatten map into array
                Object.entries(bookingsMap).forEach(([bookingId, bookingData]) => {
                    allBookings.push({
                        id: bookingId,
                        monthYear,
                        discount: 0,
                        ...bookingData,
                    });
                });
            });

            const today = new Date();

            // Upcoming vs Past
            const upcoming = allBookings.filter(
                (lead) => new Date(lead.functionDate) >= today
            );
            const past = allBookings.filter(
                (lead) => new Date(lead.functionDate) < today
            );

            // Sort upcoming
            const sortedUpcoming = upcoming.sort((a, b) => {
                const dateA = new Date(a.functionDate);
                const dateB = new Date(b.functionDate);
                return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
            });

            const finalList = [...sortedUpcoming, ...past];
            setLeads(finalList);
            setFilteredLeads(finalList);
        }, (error) => {
            console.error("Error fetching leads:", error);
        });

        return () => unsubscribe(); // cleanup listener on unmount
    }, [sortDirection]);

    useEffect(() => {
        const today = new Date();
        let filtered = [...leads];

        if (filterType === "upcoming") {
            filtered = leads.filter(l => new Date(l.functionDate) >= today);
        } else if (filterType === "past") {
            filtered = leads.filter(l => new Date(l.functionDate) < today);
        }

        setFilteredLeads(filtered);
    }, [filterType, leads]);

    const calculateTotal = (list) => {
        return list.reduce((sum, lead) => sum + (Number(lead.grandTotal) || 0), 0);
    };

    const today = new Date();

    const upcomingLeads = filteredLeads.filter(l => new Date(l.functionDate) >= today);
    const pastLeads = filteredLeads.filter(l => new Date(l.functionDate) < today);

    const upcomingCount = upcomingLeads.length;
    const pastCount = pastLeads.length;

    const upcomingTotal = calculateTotal(upcomingLeads);
    const pastTotal = calculateTotal(pastLeads);
    const allTotal = calculateTotal(filteredLeads);

    const formatAmount = (amt) =>
        amt.toLocaleString("en-IN", {
            style: "currency", currency: "INR", maximumFractionDigits: 0

        });

    const updateLead = async (leadId, updates, oldMonthYear) => {
        try {
            let newMonthYear = oldMonthYear;

            if (updates.enquiryDate) {
                const newDate = new Date(updates.enquiryDate);
                const month = newDate.toLocaleString("default", { month: "short" });
                const year = newDate.getFullYear();
                newMonthYear = `${month}${year}`;
            }

            // If monthYear changes
            if (newMonthYear !== oldMonthYear) {
                // Delete from old doc
                const oldRef = doc(db, "prebookings", oldMonthYear);
                const oldSnap = await getDoc(oldRef);
                if (oldSnap.exists()) {
                    const oldData = oldSnap.data();
                    if (oldData[leadId]) {
                        delete oldData[leadId];
                        await setDoc(oldRef, oldData, { merge: false });
                    }
                }

                // Add to new doc
                const newRef = doc(db, "prebookings", newMonthYear);
                await setDoc(newRef, {
                    [leadId]: {
                        ...updates,
                        updatedAt: new Date(),
                    },
                }, { merge: true });

            } else {
                // Same monthYear → use updateDoc for nested fields
                const ref = doc(db, "prebookings", oldMonthYear);

                await updateDoc(ref, {
                    [`${leadId}.updatedAt`]: new Date(),
                    ...Object.fromEntries(
                        Object.entries(updates).map(([key, val]) => [`${leadId}.${key}`, val])
                    )
                });
            }

            console.log("Lead updated successfully");
        } catch (error) {
            console.error("Error updating lead:", error);
        }
    };

    const handleNoteChange = (leadId, note) => {
        updateLead(leadId, { 'meals.note': note });
    };

    const handleFieldChange = async (id, field, value) => {
        setLeads(prev => prev.map(lead =>
            lead.id === id ? { ...lead, [field]: value } : lead
        ));
        setFilteredLeads(prev => prev.map(lead =>
            lead.id === id ? { ...lead, [field]: value } : lead
        ));

        try {
            await updateLead(id, { [field]: value });
        } catch (err) {
            console.error("Firestore update failed:", err);
        }

        setEditingField(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: false }
        }));
    };

    const handleDateChange = (id, index, date) => {
        const lead = leads.find(l => l.id === id);
        const updatedDates = [...(lead.followUpDates || [])];
        updatedDates[index] = date;
        updateLead(id, { followUpDates: updatedDates });
        setEditing(prev => ({ ...prev, [id]: { ...prev[id], [index]: false } }));
    };

    const startEdit = (leadId, field) => {
        setEditingField(prev => {
            if (!leadId || !field) return {}; // exit edit mode
            return {
                ...prev,
                [leadId]: { ...(prev[leadId] || {}), [field]: true }
            };
        });
    };

    const handleEdit = (id, index) => setEditing(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [index]: true } }));
    const isEditing = (id, field) => editingField[id]?.[field];

    const sendToPrint = (lead) => {
        const fmtDate = (d) => {
            if (!d) return 'N/A';
            if (d?.toDate) return d.toDate().toLocaleDateString('en-GB');
            if (typeof d === 'string' || d instanceof Date) return new Date(d).toLocaleDateString('en-GB');
            return 'N/A';
        };

        const bookingDate = fmtDate(lead.enquiryDate);
        const funcDate = fmtDate(lead.functionDate);
        const menuName = Object.keys(lead.selectedMenus || {})[0] || 'N/A';

        const amenitiesList = (lead.bookingAmenities || []).map((item, i) => `
        <tr>
            <td></td>
            <td>(${String.fromCharCode(97 + i)}) ${item}</td>
            <td colspan="3">Yes</td>
        </tr>`).join('');

        const customItems = (lead.customItems || []).map((item, i) => `
        <tr>
            <td></td>
            <td>(${String.fromCharCode(97 + i)}) ${item.name}</td>
            <td>${item.qty}</td>
            <td>${item.rate}</td>
            <td>₹${item.total}</td>
        </tr>`).join('');
        const printHTML = `
<html>
<head>
    <title>Event Booking Estimate</title>
    <style>
        body {
            font-family: 'Calibri', 'Arial', sans-serif;
            font-size: 11px;
            padding: 20px;
            padding-Top: 10px;
            color: #e10000;
        }

        h2 {
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            border: 1px solid #e10000;
            padding: 1px 8px;
            vertical-align: top;
            font-size: 12px;
        }

        th {
            background-color: #eef6ff;
            font-weight: bold;
            text-align: left;
        }

        .highlight {
            background-color: #ffff54;
            font-weight: bold;
        }

        .section-header {
            background-color: #eef6ff;
            font-weight: bold;
            text-align: center;
            padding: 3px;
            border: 1px solid #e10000;
            font-size:14px
        }

        .terms {
            font-size: 1px;
            color: red;
        }

        .terms li {
            padding: 1px 0;
        }

        .center {
            text-align: center;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="section-header" style="position: relative; text-align: center;">
        Event Booking Estimate
        <span style="position: absolute; right: 10px;">${bookingDate}</span>
    </div>

    <table style="font-weight: bold">
        <tr><th>Sl</th><th>Description</th><th colspan="3">Customer Details</th></tr>
        <tr><td>1</td><td>Customer Name</td><td colspan="3">${lead.prefix || ''} ${lead.name || ' '}</td></tr>
        <tr><td>2</td><td>Contact No.</td><td colspan="3">${lead.mobile1}${lead.mobile2 ? ', ' + lead.mobile2 : ''}</td></tr>
        <tr><td>3</td><td>Mail ID</td><td colspan="3">${lead.email || ''}</td></tr>
        <tr><td>4</td><td>Type of Event</td><td class="highlight" colspan="3">${lead.functionType || ''}</td></tr>
        <tr><td>5</td><td>Date of Event</td><td colspan="3">${funcDate}</td></tr>
        <tr><td>6</td><td>Total No. of Guests</td><td colspan="3">${lead.noOfPlates || ''} + ${lead.extraPlates || '0'} Extra</td></tr>
        <tr><td>7</td><td class="highlight">Complimentary Rooms</td><td class="highlight" colspan="3">7+2</td></tr>
        <tr><td>8</td><td>Additional Rooms @ Rs.4000/- + GST</td><td colspan="3">As per custom items</td></tr>
        <tr><td>9</td><td>Food Type</td><td colspan="3">${menuName}</td></tr>
        <tr class="highlight">
        <td>10</td><td>Start Time: ${lead.startTime
                ? (() => {
                    let [h, m] = lead.startTime.split(":").map(Number);
                    const ampm = h >= 12 ? "PM" : "AM";
                    h = h % 12 || 12;
                    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
                })()
                : ""
            }
        </td>
        <td colspan="3">
            Finish Time: ${lead.finishTime
                ? (() => {
                    let [h, m] = lead.finishTime.split(":").map(Number);
                    const ampm = h >= 12 ? "PM" : "AM";
                    h = h % 12 || 12;
                    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
                })()
                : ""
            }
          </td>
        </tr>

        <tr><th colspan="5" class="section-header">Total Package Cost</th></tr>
        <tr class="highlight"><td>1</td><td>${lead.venueType} Booking Charge (Complimentary Details as below)</td><td colspan="3">₹ ${lead.hallCharges}</td></tr>
        ${amenitiesList || '<tr><td colspan="5">No complimentary amenities listed</td></tr>'}

        <tr><td>2</td><td class="highlight">Facilities as Chargeable</td><td class="highlight">Qty</td><td class="highlight">Rate</td><td class="highlight">Total</td></tr>
        ${customItems || '<tr><td colspan="5">None</td></tr>'}

        <tr><td></td><th class="highlight">GST: On ₹ ${lead.gstBase || '0'} @18% </th><th  class="highlight" colspan="3">₹ ${lead.gstAmount || '0'}</th></tr>
        
        <tr><td></td><td colspan="5"><strong>Notes:</strong> ${lead.note}</td></tr>

        <tr><td>3</td><td class="highlight">Food Menu</td><td colspan="3">${menuName}</td></tr>
        
      ${lead.meals
                ? Object.entries(lead.meals)
                    .sort(([, a], [, b]) => new Date(a.date || 0) - new Date(b.date || 0))
                    .map(([dayName, dayData]) => {
                        const dayDate = dayData.date
                            ? new Date(dayData.date).toLocaleDateString("en-GB")
                            : null;

                        const mealOrder = ["Breakfast", "Lunch", "Dinner"];

                        return Object.entries(dayData)
                            .filter(([mealName, mealInfo]) => mealName !== "date" && mealInfo && mealInfo.total)
                            .sort(([a], [b]) => mealOrder.indexOf(a) - mealOrder.indexOf(b))
                            .map(([mealName, mealInfo]) => {
                                const formatTime = (timeStr) => {
                                    if (!timeStr) return "";
                                    let [h, m] = timeStr.split(":").map(Number);
                                    const ampm = h >= 12 ? "PM" : "AM";
                                    h = h % 12 || 12;
                                    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
                                };

                                return `
                              <tr>
                                <td></td>
                                <td colspan="1">
                                  ${mealName} - ${dayDate ? `<span class="highlight">${dayDate}</span>,` : ""}
                                 ${formatTime(mealInfo.startTime)} to ${formatTime(mealInfo.endTime)}
                                </td>
                                <td colspan="4">
                                  (${mealInfo.option}) - 
                                  Pax: <span class="highlight">${mealInfo.pax}</span>, 
                                  Rate: ₹<span class="highlight">${mealInfo.rate}</span>
                                </td>
                              </tr>
                            `;
                            })
                            .join("");
                    })
                    .join("")
                : ""}

        
        ${lead.meals?.Lunch ? `
          <tr><td></td>
            <td><strong>Lunch:</strong>
              <td colspan="3">
                Start Time: <span class="highlight">${lead.meals.Lunch.startTime}</span>,
                Finish Time: <span class="highlight">${lead.meals.Lunch.endTime}</span>,
                Pax: <span class="highlight">${lead.meals.Lunch.pax}</span>,
                Rate: ₹<span class="highlight">${lead.meals.Lunch.rate}</span>,
                Total: ₹<span class="highlight">
                  ${lead.meals.Lunch.pax * lead.meals.Lunch.rate}
                </span>
              </td>
            </td>
          </tr>` : ''}
        
        ${lead.meals?.Dinner ? `
          <tr><td></td>
            <td><strong>Dinner:</strong>
              <td colspan="3">
                Start Time: <span class="highlight">${lead.meals.Dinner.startTime}</span>,
                Finish Time: <span class="highlight">${lead.meals.Dinner.endTime}</span>,
                Pax: <span class="highlight">${lead.meals.Dinner.pax}</span>,
                Rate: ₹<span class="highlight">${lead.meals.Dinner.rate}</span>,
                Total: ₹<span class="highlight">
                  ${lead.meals.Dinner.pax * lead.meals.Dinner.rate}
                </span>
              </td>
            </td>
          </tr>` : ''}
        
        <tr><td colspan="2" class="highlight">Total Estimate</td><td class="highlight"  colspan="3"><strong  class="highlight">₹${(lead.grandTotal || 0).toLocaleString()}</strong></td></tr>

    </table>

    <div class="section-header">Terms & Conditions</div>
    <table border="1" cellspacing="0" cellpadding="6">
      ${[
                "GST 18% Extra as applicable.",
                "Booking Advance 25% at the time of signing of the agreement after that rest amount will be payable before 30 days of the function",
                "Any Pet will not allowed in the premises.",
                "Complimentary Room Check-in Starts from 11:30 AM onwards on function date & Check-Out time 8:00 AM",
                "DJ & Sound Music will not allowed after 10 PM.",
                "No Refund or extension of Date is permitted.",
                "One security Cheque and Adharcard to be deposited at the time of booking.",
                "In Case of any damage to the premises, you are responsible and have to pay by customer for the damage.",
                "Extra usage of venue beyond the special time would be charged extra on an hourly basis.",
                "The hall should be vacant on or before the end time mentioned in contract.",
                "In case of extension of time. Applicable charges will Levied on an Hourly Basis subject to its availability.",
                "Booking Cancel will be acceptable before 1 month from function date & it will be extendable only.",
                "50% amount will be refunded, if booking will be cancel within 1 month from function date.",
                "Any physical damage will be responsible & pay by customer.",
                "Security Charges will be applicable @Rs. 10,000/-",
                "Kindly Note that the Shangri-La Palace does not allow fire crackers within or around the Vicinity of the Premises.",
                "Consumption of Alcohol / Intoxicating item and smoking is strictly prohibited inside our premises."
            ].map((t, i) => `<tr><td>${i + 1}</td><td>${t}</td></tr>`).join('')}
        </table>
        <!-- Signature Section -->
            <table style="width:100%; margin-top: 20px; border: none;">
              <tr>
              <td style="width:50%; text-align:center; border:none; vertical-align:bottom;">
                _________________________<br>
                Guest's Signature
              </td>
              <td style="width:50%; text-align:center; border:none; vertical-align:bottom;">
               ${lead?.eventBookedByl || "Sales Team"}<br>
              _________________________<br>
                Authorized Signatory<br>
              </td>
            </tr>
        </table>
</body>
</html>`;

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(printHTML);
        iframe.contentDocument.close();

        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    };

    useEffect(() => {
        const term = searchTerm.toLowerCase().replace(/\//g, "-").trim();

        const normalizeDate = (dateStr) => {
            // Firestore se aa raha mostly: YYYY-MM-DD
            // User type kar sakta: DD-MM-YYYY
            if (!dateStr) return "";

            const parts = dateStr.split("-");
            if (parts.length === 3) {
                const [y, m, d] =
                    parts[0].length === 4 ? [parts[0], parts[1], parts[2]] : [parts[2], parts[1], parts[0]];

                // Return dono format
                return [
                    `${d}-${m}-${y}`, // DD-MM-YYYY
                    `${y}-${m}-${d}`, // YYYY-MM-DD
                ];
            }
            return [dateStr];
        };

        const filtered = leads.filter((booking) => {
            return Object.entries(booking).some(([key, val]) => {
                if (typeof val === "string") {
                    const normalizedVal = val.toLowerCase().replace(/\//g, "-");

                    if (key === "functionDate") {
                        // multiple formats se check
                        const dateFormats = normalizeDate(normalizedVal);
                        return dateFormats.some((fmt) => fmt.includes(term));
                    }

                    return normalizedVal.includes(term);
                }
                return false;
            });
        });

        setFilteredLeads(filtered);
    }, [searchTerm, leads]);

    const eventCounts = {};
    filteredLeads.forEach(lead => {
        const events = Array.isArray(lead.functionType) ? lead.functionType : [lead.functionType];
        events.forEach(ev => {
            if (!ev) return;
            if (eventCounts[ev]) {
                eventCounts[ev] += 1;
            } else {
                eventCounts[ev] = 1;
            }
        });
    });

    const totalEvents = Object.values(eventCounts).reduce((sum, count) => sum + count, 0);
    const rightRef = useRef(null);

    const handleLocalChange = (leadId, field, value) => {
        setLocalValue(prev => ({
            ...prev,
            [leadId]: {
                ...prev[leadId],
                [field]: value
            }
        }));
    };

    const [localValue, setLocalValue] = useState({});

    const headerStyle = { textAlign: "center", padding: "2px", border: "2px solid transparent", fontSize: '13px', fontWeight: '700', color: 'black' };
    const cellStyle = { padding: "2px", border: "2px solid transparent" };

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

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year}`;
    };

    return (
        <div className="leads-table-container">
            <div style={{ marginBottom: '30px' }}> <BackButton />  </div>
            <div className="table-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}> <h2 className="leads-header" style={{ margin: 0 }}>📋 Leads</h2> </div>
            </div>

            <div>
                <input
                    type="text"
                    placeholder="Search by name, Event or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        padding: "0.5rem 1rem",
                        marginTop: "1rem",
                        width: "100%",
                        borderRadius: "30px",
                        border: "1px solid #ccc",
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
                <button
                    onClick={() => navigate('/booking')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                    }}
                >
                    Create New Booking
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'start', gap: '15px' }}>
                <div style={{ textAlign: 'left' }} className="win-prob-legend">
                    <ul style={{ display: 'inline-block', listStyle: 'none', padding: 0 }}>
                        <strong>🎯 Venue Type :</strong>
                        {["Hall with Front Lawn", "Hall with Front & Back Lawn", "Pool Side", "All Venues"].map((type, idx) => (
                            <li
                                key={type}
                                onClick={() => setVenueFilter(type === "All Venues" ? "all" : type)}
                                style={{
                                    cursor: "pointer",
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    backgroundColor: venueFilter === (type === "All Venues" ? "all" : type) ? "#007BFF" : "#f0f0f0",
                                    color: venueFilter === (type === "All Venues" ? "all" : type) ? "#fff" : "#000",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                }}
                            >
                                {type !== "All Venues" && (
                                    <span
                                        className={`legend-box ${["Pool Side", "Lawn", "Back Lawn"].includes(type)
                                            ? "high-prob"
                                            : type === "Hall with Front & Back Lawn"
                                                ? "front-lawn"
                                                : "very-high-prob"
                                            }`}
                                    />
                                )}
                                {type}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className='event-summary-container'>
                    <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '400px' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #ccc', padding: '0px 2px', textAlign: 'center' }}>Event</th>
                                <th style={{ border: '1px solid #ccc', padding: '0px 2px', textAlign: 'center' }}>Cnt.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(eventCounts)
                                .sort((a, b) => b[1] - a[1])
                                .map(([event, count]) => (
                                    <tr key={event}>
                                        <td style={{ border: '1px solid #ccc', padding: '0px 2px', textAlign: 'left' }}>{event}</td>
                                        <td style={{ border: '1px solid #ccc', padding: '0px 2px', textAlign: 'center' }}>{count}</td>
                                    </tr>
                                ))
                            }
                            <tr>
                                <td style={{ border: '1px solid #ccc', padding: '0px 2px', fontWeight: 'bold', color: 'red' }}>Total Events</td>
                                <td style={{ border: '1px solid #ccc', padding: '0px 2px', textAlign: 'center', fontWeight: 'bold', color: 'red' }}>
                                    {totalEvents}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>

            <div style={{ display: 'none' }}><button onClick={() => setSortDirection('asc')}></button><button onClick={() => setSortDirection('desc')}></button> </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", marginTop: '20px' }}>
                <button
                    onClick={() => setFilterType("upcoming")}
                    style={{
                        backgroundColor: filterType === "upcoming" ? "#007BFF" : "#a8dbffff",
                        color: filterType === "upcoming" ? "#fff" : "#000",
                        borderRadius: "8px",
                        padding: "8px",
                        cursor: "pointer",
                    }}
                >
                    Upcoming ({upcomingCount}) {formatAmount(upcomingTotal)}
                </button>

                <button
                    onClick={() => setFilterType("past")}
                    style={{
                        backgroundColor: filterType === "past" ? "#007BFF" : "#a8dbffff",
                        color: filterType === "past" ? "#fff" : "#000",
                        borderRadius: "8px",
                        padding: "8px",
                        cursor: "pointer",
                    }}
                >
                    Past ({pastCount}) {formatAmount(pastTotal)}
                </button>

                <button
                    onClick={() => setFilterType("all")}
                    style={{
                        backgroundColor: filterType === "all" ? "#007BFF" : "#a8dbffff",
                        color: filterType === "all" ? "#fff" : "#000",
                        borderRadius: "8px",
                        padding: "8px",
                        cursor: "pointer",
                    }}
                >
                    All ({filteredLeads.length}) {formatAmount(allTotal)}
                </button>
            </div>

            <div className="filters-container">
                <div className="date-filters">
                    <div className="filter-item">
                        <label>From:</label>
                        <input className="filterInput" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>

                    <div className="filter-item">
                        <label>To:</label>
                        <input className="filterInput" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>

                    <div className="filter-item">
                        <label>FY Year:</label>
                        <select className="filterInput" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)}>
                            <option value="">All</option>
                            {availableFY.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                        </select>
                    </div>

                    <button
                        className="clear-btnq"
                        onClick={() => {
                            setFromDate('');
                            setToDate('');
                            setFinancialYear('');
                            setFilteredLeads(leads);
                        }}
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div style={{ position: 'relative' }}>

                <div style={{ display: "flex", width: "100%", gap: '2px' }}>

                    {/* Left Table */}
                    <div style={{ flex: '0 0 80px', overflowX: "auto" }}>
                        <table className="leads-table">
                            <thead>
                                <tr >
                                    <td colSpan={7} style={{ textAlign: 'center', backgroundColor: '#fff', color: 'white', fontWeight: '800', fontSize: '15px', whiteSpace: 'nowrap' }}>
                                        B. Food Services
                                    </td>
                                </tr>
                            </thead>

                            <thead>
                                <tr>
                                    <th onClick={() => requestSort('functionDate')} style={{ cursor: 'pointer', padding: '1px' }}>
                                        Event Date {sortConfig.key === 'functionDate' ? (sortConfig.direction === 'asc' ? "" : "") : ''}
                                    </th>

                                    {['Party Name'].map(header => (<th key={header}>{header}</th>))}
                                    <th>
                                        <button style={{ backgroundColor: "#66363606", color: "#fff", border: "none", borderRadius: "4px", margin: '0 auto', display: 'flex', padding: '0px', justifyContent: 'center' }}>
                                            <img
                                                src="../../assets/whatsappp.png"
                                                alt=""
                                                style={{ width: '0px', height: '28px' }}
                                            />
                                        </button>
                                    </th>
                                    <th style={{ fontSize: '21px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center' }} >  {'🖨️'} </div>
                                    </th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
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
                                        {['functionDate'].map((field, index) => (
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


                                        {['name'].map((field, index) => (
                                            <td
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '180rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    fontWeight: '700',
                                                    padding: '0px 2px 0px 5px',
                                                    fontSize: '13px'
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
                                                            : (lead[field] ?? '')
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
                                                            border: '2px solid #00000001',
                                                            boxShadow: 'none'
                                                        }}
                                                    >
                                                        <thead>
                                                            <tr
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
                                                                <td style={{ ...headerStyle, color: 'transparent' }}>A</td>
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
                                                                    <td style={cellStyle}>
                                                                        {menuData.selectedSubItems && menuData.selectedSubItems.length > 0 ? (
                                                                            <button
                                                                                style={{
                                                                                    padding: '2px 6px',
                                                                                    fontSize: '12px',
                                                                                    backgroundColor: 'transparent',
                                                                                    borderRadius: 4,
                                                                                    cursor: 'pointer',
                                                                                    color: 'transparent',
                                                                                    boxShadow: 'none'
                                                                                }}
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

                                                                style={{
                                                                    color: 'transparent',
                                                                    textDecoration: 'none',
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
                                                                        border: "2px solid #000000e8",

                                                                    }}
                                                                >
                                                                    <thead>

                                                                        <tr
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
                                                                            <td colSpan={6} style={{ ...headerStyle, textAlign: "center", color: 'transparent', backgroundColor: 'transparent' }}>
                                                                                {dayName} ({dayData.date ? new Date(dayData.date).toLocaleDateString() : "No date"})
                                                                            </td>
                                                                        </tr>
                                                                        <tr
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
                                                                        >                                                                            <td style={{ ...headerStyle, color: 'transparent', backgroundColor: 'transparent' }}>Items</td>
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

                                                                                        <td style={cellStyle}>
                                                                                            {mealInfo.selectedItems && mealInfo.selectedItems.length > 0 ? (
                                                                                                <button
                                                                                                    style={{
                                                                                                        padding: '2px 6px',
                                                                                                        fontSize: '12px',
                                                                                                        backgroundColor: '#4dd21903',
                                                                                                        color: 'transparent',
                                                                                                        borderRadius: 4,
                                                                                                        cursor: 'pointer'
                                                                                                    }}
                                                                                                >
                                                                                                    View Items ({mealInfo.selectedItems.length})
                                                                                                </button>
                                                                                            ) : "-"}
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

                                        < td >
                                            <div style={{ color: 'transparent' }}>
                                                ₹{lead.advancePayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0}
                                            </div>
                                            <div>
                                                <button
                                                    style={{
                                                        padding: "4px 8px", cursor: "pointer",
                                                        background: "transparent",
                                                        color: 'transparent'
                                                    }}
                                                >
                                                    View Advances
                                                </button>
                                            </div>
                                        </td>

                                        {['source'].map(field => (
                                            <td key={`${lead.id}-${field}`}
                                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px', color: 'transparent' }}
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
                                                        <small style={{ color: 'transparent' }}>
                                                            By: <strong>{lead.referredBy || '—'}</strong>
                                                        </small>
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                    </tr >
                                ))}

                            </tbody >
                        </table>
                    </div>

                    {/* Right Table */}
                    <div ref={rightRef} style={{ flex: "1", overflowX: "auto" }}>
                        <table className="leads-table">
                            <Tbody
                                leads={sortedLeads}
                                setLeads={setLeads}
                                isEditing={isEditing}
                                editing={editing}
                                handleFieldChange={handleFieldChange}
                                handleEdit={handleEdit}
                                handleNoteChange={handleNoteChange}
                                handleDateChange={handleDateChange}
                                startEdit={startEdit}
                                moveLeadToDrop={moveLeadToDrop}
                                sendToPrint={sendToPrint}
                                userPermissions={userPermissions}
                                sortConfig={sortConfig}
                                requestSort={requestSort}
                            />
                        </table>
                    </div>

                </div>

                {/* Left Scroll Button */}
                <button
                    onClick={() =>
                        rightRef.current?.scrollBy({ left: -300, behavior: "smooth" })
                    }
                    style={{
                        position: "fixed",
                        left: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 999,
                        background: "rgba(255, 255, 255, 0.33)",
                        border: "1px solid #ccc",
                        borderRadius: "50%",
                        width: "40px",
                        height: "40px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        cursor: "pointer",
                        color: "black",
                    }}
                >
                    ◀
                </button>

                {/* Right Scroll Button */}
                <button
                    onClick={() =>
                        rightRef.current?.scrollBy({ left: 300, behavior: "smooth" })
                    }
                    style={{
                        position: "fixed",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 999,
                        background: "rgba(255, 255, 255, 0.33)",
                        border: "1px solid #ccc",
                        borderRadius: "50%",
                        width: "40px",
                        height: "40px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        cursor: "pointer",
                        color: "black",
                    }}
                >
                    ▶
                </button>

            </div>

            <div style={{ marginBottom: '50px' }}></div>
        </div>
    );
};

export default BookingLeadsTable; 