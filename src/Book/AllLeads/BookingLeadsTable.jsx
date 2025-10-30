import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteField, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import './BookingLeadsTable.css';
import Tbody from './Tbody';
import BackButton from "../../components/BackButton";
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const BookingLeadsTable = () => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [editingField, setEditingField] = useState({});
    const [editing, setEditing] = useState({});
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [searchTerm, setSearchTerm] = useState("");
    const [sortDirection, setSortDirection] = useState('asc');
    const [userPermissions, setUserPermissions] = useState({ editData: "disable", editablePrebookings: [], accessToApp: '', alwayEdit: '' });
    const [filteredLeads, setFilteredLeads] = useState(leads);
    const [availableFY, setAvailableFY] = useState([]);
    const [filterType, setFilterType] = useState("all");
    const [venueFilter, setVenueFilter] = useState("all");
    const [sortConfig, setSortConfig] = useState({ key: 'functionDate', direction: 'desc' });
    const [financialYear, setFinancialYear] = useState("");
    const [expenseModalOpen, setExpenseModalOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState(null);
    const [eventExpenses, setEventExpenses] = useState([]);

    const closeExpenseModal = () => {
        setSelectedLeadId(null);
        setExpenseModalOpen(false);
    };

    const fetchAdminEventExpenses = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "usersAccess"));
            let adminExpenses = [];
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.accessToApp === "A" && Array.isArray(data.eventExpenses)) {
                    adminExpenses = data.eventExpenses;
                }
            });
            return adminExpenses;
        } catch (err) {
            console.error("Error fetching admin event expenses:", err);
            return [];
        }
    };

    const openExpenseModal = async (leadId) => {
        setSelectedLeadId(leadId);

        try {
            const lead = leads.find(l => l.id === leadId);
            if (!lead) return;

            const monthYear = lead.monthYear || formatMonthYear(lead.functionDate);
            const leadRef = doc(db, "prebookings", monthYear);
            const leadSnap = await getDoc(leadRef);

            let expensesToLoad = [];

            // ✅ Step 1: Check if prebookings already have eventExpenses
            if (leadSnap.exists()) {
                const data = leadSnap.data();
                const leadData = data[leadId];
                if (leadData && Array.isArray(leadData.eventExpenses) && leadData.eventExpenses.length > 0) {
                    expensesToLoad = leadData.eventExpenses;
                    console.log("Loaded eventExpenses from prebookings");
                }
            }

            // ✅ Step 2: If no eventExpenses found in prebookings → fetch from admin
            if (expensesToLoad.length === 0) {
                const adminExpenses = await fetchAdminEventExpenses();
                if (adminExpenses.length > 0) {
                    expensesToLoad = adminExpenses.map(exp => ({
                        item: exp.item || "",
                        rate: exp.rate || ""
                    }));
                    console.log("Loaded default eventExpenses from usersAccess");
                } else {
                    expensesToLoad = [{ item: "", rate: "" }];
                    console.log("No eventExpenses found in admin");
                }
            }

            setEventExpenses(expensesToLoad);
            setExpenseModalOpen(true);

        } catch (err) {
            console.error("Error opening expense modal:", err);
        }
    };

    const saveExpense = async () => {
        if (!selectedLeadId) return;
        try {
            const lead = leads.find(l => l.id === selectedLeadId);
            if (!lead) return;

            const monthYear = lead.monthYear || formatMonthYear(lead.functionDate);
            const leadRef = doc(db, "prebookings", monthYear);

            // ✅ Save the eventExpenses array back to Firestore
            await updateDoc(leadRef, {
                [`${selectedLeadId}.eventExpenses`]: eventExpenses
            });

            closeExpenseModal();
            console.log("Event expenses saved successfully!");
        } catch (err) {
            console.error("Error saving event expenses:", err);
        }
    };

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
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        // Create a real-time listener
        const userRef = doc(db, "usersAccess", user.email);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserPermissions({
                    editData: data.editData || "disable",
                    alwayEdit: data.alwayEdit || "",
                    editablePrebookings: data.editablePrebookings || [],
                    accessToApp: data.accessToApp || "",
                });
            }
        }, (err) => {
            console.error("Error fetching user permissions:", err);
        });

        // Cleanup listener on unmount
        return () => unsubscribe();
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

    const moveLeadToDrop = (leadId, removeOriginal = false, reason = '', monthYear) => {
        try {
            const monthRef = doc(db, "prebookings", monthYear);

            // Listen to the month document in real-time
            const unsubscribe = onSnapshot(monthRef, async (monthSnap) => {
                if (!monthSnap.exists()) return;

                const monthData = monthSnap.data();
                const leadData = monthData[leadId];
                if (!leadData) return;

                // Determine monthYear for bookingLeads based on enquiryDate
                const enquiryDateObj = new Date(leadData.enquiryDate);
                const monthNames = [
                    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                ];
                const pastMonthYear = `${monthNames[enquiryDateObj.getMonth()]}${enquiryDateObj.getFullYear()}`;
                const pastRef = doc(db, "cancelledBookings", pastMonthYear);

                // Move lead to cancelledBookings
                await setDoc(
                    pastRef,
                    {
                        [leadId]: {
                            ...leadData,
                            droppedAt: new Date(),
                            dropReason: reason || "No reason provided"
                        }
                    },
                    { merge: true }
                );

                // Optionally remove original lead
                if (removeOriginal) {
                    await updateDoc(monthRef, { [leadId]: deleteField() });
                }

                // Unsubscribe after operation to avoid repeated triggers
                unsubscribe();
            });

        } catch (error) {
            console.error("Error moving lead to pastEnquiry:", error);
        }
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "prebookings"), (querySnapshot) => {
            const allBookings = []; // ✅ always start clean on each snapshot

            querySnapshot.docs.forEach((docSnap) => {
                const monthYear = docSnap.id;
                const bookingsMap = docSnap.data();

                Object.entries(bookingsMap || {}).forEach(([bookingId, bookingData]) => {
                    allBookings.push({
                        id: bookingId,
                        monthYear,
                        discount: 0,
                        ...bookingData,
                    });
                });
            });

            // ✅ Remove duplicates by unique id
            const uniqueBookings = Array.from(
                new Map(allBookings.map(item => [item.id, item])).values()
            );

            const today = new Date();

            const upcoming = uniqueBookings.filter(
                (lead) => new Date(lead.functionDate) >= today
            );
            const past = uniqueBookings.filter(
                (lead) => new Date(lead.functionDate) < today
            );

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

        return () => unsubscribe();
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
        // Optimistically update local state
        setLeads(prev => prev.map(lead =>
            lead.id === id ? { ...lead, [field]: value } : lead
        ));
        setFilteredLeads(prev => prev.map(lead =>
            lead.id === id ? { ...lead, [field]: value } : lead
        ));

        setEditingField(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: false }
        }));

        try {
            await updateLead(id, { [field]: value });
        } catch (err) {
            console.error("Firestore update failed:", err);
            // Rollback if needed
            setLeads(prev => prev.map(lead =>
                lead.id === id ? { ...lead, [field]: lead[field] } : lead
            ));
            setFilteredLeads(prev => prev.map(lead =>
                lead.id === id ? { ...lead, [field]: lead[field] } : lead
            ));
        }
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

    const sendToPrint = async (lead) => {

        const auth = getAuth();
        const user = auth.currentUser;
        let termsList = [];

        if (user) {
            try {
                const userRef = doc(db, "usersAccess", user.email);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    if (data.accessToApp === "A" && typeof data.termsAndConditions === "string") {
                        // Split the string into numbered array
                        termsList = data.termsAndConditions
                            .split(/\s*\d+\.\s*/)   // split by numbers with dot
                            .filter(t => t.trim() !== "");
                    }
                }
            } catch (err) {
                console.error("Error fetching termsAndConditions:", err);
            }
        }

        const termsHTML = termsList.length
            ? termsList.map((t, i) => `<tr><td>${i + 1}</td><td>${t}</td></tr>`).join("")
            : `<tr><td colspan="2">No Terms & Conditions found</td></tr>`;


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
        <span style="position: absolute; right: 10px;">Booked on: ${bookingDate}</span>
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
      ${termsHTML}
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





    const getCateringAmount = async (lead) => {
        try {
            // Step 1: Get all docs under "catering"
            const cateringColRef = collection(db, "catering");
            const cateringSnap = await getDocs(cateringColRef);

            if (cateringSnap.empty) {
                console.log("⚠️ No documents inside 'catering' collection");
                return [];
            }

            // Step 2: Use the first document (whatever its name is)
            const firstDoc = cateringSnap.docs[0];
            const cateringMap = firstDoc.data();

            // Step 3: Access your lead ID key
            const cateringData = cateringMap[lead.id];

            if (!cateringData) {
                console.log("⚠️ No catering data found for lead:", lead.id);
                return [];
            }

            console.log("✅ Catering fetched for lead:", lead.id, cateringData);
            return [cateringData];
        } catch (error) {
            console.error("❌ Error fetching catering:", error);
            return [];
        }
    };

    const getVendorRoyalties = async (lead) => {
        try {
            const collections = ["vendor", "decoration"];
            const royalties = [];

            for (const col of collections) {
                const colRef = collection(db, col);
                const snap = await getDocs(colRef);

                if (snap.empty) continue;

                const firstDoc = snap.docs[0];
                const dataMap = firstDoc.data();
                const leadData = dataMap[lead.id];

                if (!leadData) continue;

                // Sum royaltyAmount from all services
                const totalRoyalty = (leadData.services || []).reduce(
                    (sum, srv) => sum + (Number(srv.royaltyAmount) || 0),
                    0
                );

                if (totalRoyalty > 0) {
                    royalties.push({
                        from: col === "vendor" ? "Vendor" : "Decoration",
                        totalRoyalty,
                    });
                }
            }

            console.log("✅ Grouped royalties:", royalties);
            return royalties;
        } catch (error) {
            console.error("❌ Error fetching royalties:", error);
            return [];
        }
    };

    const sendToPrintPayment = async (lead) => {

        const fmtDateIST = (dateString) => {
            if (!dateString) return 'N/A';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata'
                });
            } catch {
                return 'N/A';
            }
        };

        // --- Payment Rows from advancePayments ---
        const paymentRows = (lead.advancePayments || []).map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${fmtDateIST(p.addedAt || p.receiptDate)}</td>
            <td>${p.slNo || ''}</td>
            <td>${p.mode || ''}</td>
            <td style="text-align: right;">${p.amount?.toLocaleString('en-IN') || ''}</td>
            <td>${p.description || ''}</td>
        </tr>
    `).join('');

        const totalReceived = (lead.advancePayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        // --- Define key monetary values early ---
        const hallCharges = Number(lead.hallCharges || 0);
        const gst = Number(lead.gstAmount || 0);
        const grandTotal = Number(lead.grandTotal || 0);
        const discount = Number(lead.discount || 0);

        // --- FETCH CATERING DATA ---
        const caterings = await getCateringAmount(lead);
        let cateringExpenseRows = [];

        if (caterings && caterings.length > 0) {
            cateringExpenseRows = caterings.map((c) => {
                const assignedMenus = c.assignedMenus || {};
                let grandTotalc = 0;
                for (const [, menu] of Object.entries(assignedMenus)) {
                    const qty = Number(menu.qty || 0);
                    const extQty = Number(menu.extQty || 0);
                    const rate = Number(menu.rate || 0);
                    const total = (qty + extQty) * rate;
                    grandTotalc += total;
                }
                return {
                    item: c.CateringAssignName || "Unnamed Catering",
                    rate: grandTotalc || 0
                };
            });
        }

        // --- FETCH EVENT EXPENSES ---
        let eventExpenses = [];

        try {
            const monthYear = lead.monthYear || (() => {
                const d = new Date(lead.functionDate);
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return `${monthNames[d.getMonth()]}${d.getFullYear()}`;
            })();

            const prebookingRef = doc(db, "prebookings", monthYear);
            const prebookingSnap = await getDoc(prebookingRef);

            if (prebookingSnap.exists()) {
                const monthData = prebookingSnap.data();
                const leadData = monthData[lead.id];
                if (leadData && Array.isArray(leadData.eventExpenses) && leadData.eventExpenses.length > 0) {
                    eventExpenses = leadData.eventExpenses;
                    console.log("✅ Using eventExpenses from prebookings:", monthYear);
                }
            }

            if (eventExpenses.length === 0) {
                const accessQuery = query(collection(db, "usersAccess"), where("accessToApp", "==", "A"));
                const accessSnap = await getDocs(accessQuery);
                if (!accessSnap.empty) {
                    const firstAdmin = accessSnap.docs[0].data();
                    if (Array.isArray(firstAdmin.eventExpenses)) {
                        eventExpenses = firstAdmin.eventExpenses;
                        console.log("✅ Using eventExpenses from usersAccess");
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching eventExpenses:", err);
        }

        // --- MERGE EXPENSES + CATERING + GST ---
        const gstExpenseRow = gst > 0 ? [{ item: "GST", rate: gst }] : [];
        const allExpenses = [...eventExpenses, ...cateringExpenseRows, ...gstExpenseRow];

        const vendorRows = (allExpenses || []).map(
            (exp, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${exp.item || ""}</td>
                <td style="text-align: right;">${Number(exp.rate || 0).toLocaleString("en-IN")}</td>
            </tr>
        `
        ).join("");

        // --- FETCH VENDOR ROYALTIES ---
        const royalties = await getVendorRoyalties(lead);

        // Make sure no undefined numbers break printing
        const royaltyRows = (royalties || [])
            .map((r, i) => {
                const amount = Number(r.totalRoyalty || 0);
                return `
            <tr>
                <td>${i + 1}</td>
                <td>${r.from}</td>
                <td style="text-align:right;">${amount.toLocaleString('en-IN')}</td>
            </tr>
            `;
            })
            .join("");

        const totalRoyalty = (royalties || []).reduce(
            (sum, r) => sum + (Number(r.totalRoyalty) || 0),
            0
        );

        // --- Calculate Meal Totals ---
        const getMealTotal = (mealType) => {
            let total = 0;
            const dayMeals = lead.meals || {};
            for (const dayKey of Object.keys(dayMeals)) {
                const meal = dayMeals[dayKey][mealType];
                if (meal && meal.total) total += Number(meal.total);
            }
            return total;
        };

        const breakfastLunch = getMealTotal("Breakfast") + getMealTotal("Lunch");
        const panCounter = Number(lead.panCounter || 0);

        // --- Dinner Calculation ---
        const selectedMenus = lead.selectedMenus || {};
        let noOfPlates = 0, extraPlates = 0, dinnerRate = 0, dinnerTotal = 0;
        const firstMenuKey = Object.keys(selectedMenus)[0];
        if (firstMenuKey) {
            const dinnerMenu = selectedMenus[firstMenuKey];
            noOfPlates = Number(dinnerMenu.noOfPlates || 0);
            extraPlates = Number(dinnerMenu.extraPlates || 0);
            dinnerRate = Number(dinnerMenu.rate || 0);
            dinnerTotal = (noOfPlates + extraPlates) * dinnerRate;
        }

        // --- Custom Items ---
        const selectedCustomItems = (lead.customItems || []).filter(item => item.selected && Number(item.total) > 0);
        const customItemsRows = selectedCustomItems.map(item => {
            let shortName = /jaimala/i.test(item.name || "") ? "Jaimala" : (item.name || "");
            return `
            <tr>
                <td>${shortName}</td>
                <td>${item.qty || ""}</td>
                <td>${item.rate?.toLocaleString("en-IN") || ""}</td>
                <td style="text-align: right;">${item.total?.toLocaleString("en-IN") || ""}</td>
            </tr>
        `;
        }).join("");

        // --- Payment Calculation Rows ---
        let paymentCalculationRows = "";
        const addRow = (label, value, qty = "", rate = "") => {
            if (Number(value) > 0) {
                paymentCalculationRows += `
                <tr>
                    <td>${label}</td>
                    <td>${qty}</td>
                    <td>${rate}</td>
                    <td style="text-align: right;">${Number(value).toLocaleString("en-IN")}</td>
                </tr>
            `;
            }
        };

        addRow("Hall Charges & Others", hallCharges);
        addRow("GST", gst);
        addRow("Breakfast & Lunch", breakfastLunch);
        addRow("Pan Counter", panCounter);
        if (dinnerTotal > 0)
            addRow("Dinner", dinnerTotal, `${noOfPlates.toLocaleString("en-IN")} + ${extraPlates.toLocaleString("en-IN")}`, dinnerRate.toLocaleString("en-IN"));

        paymentCalculationRows += customItemsRows;

        // --- Totals ---
        const outstandingAmount = grandTotal - totalReceived;
        const netExp = (allExpenses || []).reduce((sum, exp) => sum + (Number(exp.rate) || 0), 0);
        const totalBusiness = grandTotal - netExp + totalRoyalty;

        // --- HTML ---
        const printHTML = `
            <html>
            <head>
                <title>Total Payment Settlement - ${lead.eventDate}</title>
                <style>
                    body { font-family: Calibri, Arial, sans-serif; font-size: 15px; padding: 7px; margin: 0; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                    th, td { border: 1px solid #000; padding: 3px 6px; text-align: left; vertical-align: top; font-size: 14px }
                    th { background-color: #f4f4f4; text-align: center; }
                    .section { background-color: #ffec8b; font-weight: bold; padding: 5px; }
                    .highlight-red { background-color: #ff5050; color: white; font-weight: bold; text-align: center; }
                    .highlight-green { background-color: #ccffcc; font-weight: bold; text-align: center; }
                    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
            </head>
            <body>
        
                <table>
                    <tr><td colspan="2" class="section" style="text-align:center;">Total Payment Settlement</td></tr>
                    <tr><td>Customer Name</td><td>${lead.name || ''}</td></tr>
                    <tr><td>Contact No.</td><td>${lead.mobile1 || ''}</td></tr>
                    <tr><td>Event Type</td><td>${lead.functionType || ''}</td></tr>
                    <tr><td>Event Date</td><td>${fmtDateIST(lead.functionDate)}</td></tr>
                    <tr><td>Food Menu</td><td>${Object.keys(lead.selectedMenus || {}).join(', ')}</td></tr>
                </table>
        
                <table>
                    <tr><td colspan="7" class="section" style="text-align:center;">Payment Details</td></tr>
                    <tr><th>Sl</th><th>Payment Date</th><th>Receipt No.</th><th>Payment Mode</th><th>Amount</th><th>Remark</th></tr>
                    ${paymentRows}
                </table>
        
                <table style="float:left; width:100%;">
                    <tr><td colspan="4" class="section" style="text-align:center;">Payment Calculation</td></tr>
                    <tr><th>Particulars</th><th>Qty</th><th>Rate</th><th>Total</th></tr>${paymentCalculationRows}
                    <tr><td colspan="3" class="section">Total</td><td class="section" style="text-align:right;">${(grandTotal + discount).toLocaleString('en-IN')}</td></tr>
                    <tr><td colspan="3">Discount</td><td style="text-align:right;">${discount.toLocaleString('en-IN')}</td></tr>
                    <tr><td colspan="3" class="section">Grand Total</td><td class="section" style="text-align:right;">${(grandTotal).toLocaleString('en-IN')}</td></tr>
                    <tr><td colspan="3">Received Amount</td><td style="text-align:right;">${totalReceived.toLocaleString('en-IN')}</td></tr>
                    <tr class="highlight-red"><td colspan="3">Outstanding Amount</td><td style="text-align:right;">${outstandingAmount.toLocaleString('en-IN')}</td></tr>
                </table>
        



                <table style="width:49.5%; float:left;">
                    <tr><td colspan="3" class="section" style="text-align:center;">List of Expenses</td></tr>
                    <tr><th>Sl</th><th>Particulars </th><th>Amount</th></tr>
                    ${vendorRows}
                    <tr><td colspan="2" class="section">Net Expense</td><td class="section" style="text-align:right;">${netExp.toLocaleString('en-IN')}</td></tr>
                </table>

                <table style="width:49.5%; float:right;">
                    <tr><td colspan="3" class="section" style="text-align:center;">List of Royalties</td></tr>
                    <tr><th>Sl</th><th>From</th><th>Amount</th></tr>
                    ${royaltyRows || '<tr><td colspan="3" style="text-align:center;">No Royalties Found</td></tr>'}
                    <tr>
                        <td colspan="2" class="section">Total Royalty</td>
                        <td class="section" style="text-align:right;">${totalRoyalty.toLocaleString('en-IN')}</td>
                    </tr>
                </table>
                
                

                <div style="clear:both; margin-top:15px; text-align:right;">
                    <b>Total Business from event ( Grand Total - Net Expense + Total Royalty ) :</b> <b style="color:green;"> ₹ ${totalBusiness.toLocaleString('en-IN')} </b> <br>
                </div>
                



            </body>
            </html>`;

        // --- Print Logic ---
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

    const headerStyle = { textAlign: "center", padding: "2px", border: "2px solid transparent", fontSize: '13px', fontWeight: '700', color: 'transparent', boxShadow: 'none' };
    const cellStyle = { padding: "2px", border: "2px solid transparent", boxShadow: 'none' };

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

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            // Convert sheet to JSON
            const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
            console.log("Imported Data:", data);

            for (const row of data) {
                try {
                    const leadId = row.ID || Date.now().toString();
                    const monthYear = row.functionDate ? formatMonthYear(row.functionDate) : "Unknown";

                    // Parse bookingAmenities as array
                    const bookingAmenities = row.bookingAmenities
                        ? row.bookingAmenities.split(",").map(item => item.trim())
                        : [];

                    // Parse customItems string to array of objects
                    const customItems = row.customItems
                        ? row.customItems.split("|").map((item, index) => {
                            const match = item.match(/(.+?)\s*\((\d+)\s*x\s*(\d+)\)\s*=\s*(\d+)/);
                            if (!match) return null;
                            return {
                                id: index + 1,
                                name: match[1].trim(),
                                qty: Number(match[2]),
                                rate: Number(match[3]),
                                selected: true,
                                total: Number(match[4])
                            };
                        }).filter(Boolean)
                        : [];

                    // Parse customMenuCharges string to array of objects
                    const customMenuCharges = row.customMenuCharges
                        ? row.customMenuCharges.split("|").map((item, index) => {
                            const match = item.match(/(.+?)\s*\((\d+)\s*x\s*(\d+)\)\s*=\s*(\d+)/);
                            if (!match) return null;
                            return {
                                id: index + 1,
                                name: match[1].trim(),
                                qty: Number(match[2]),
                                rate: Number(match[3]),
                                selected: true,
                                total: Number(match[4])
                            };
                        }).filter(Boolean)
                        : [];

                    // Parse selectedMenus if it's in string format (example: "Golden Veg: 360 x 1600 = 576000")
                    const selectedMenus = {};
                    if (row.selectedMenus) {
                        row.selectedMenus.split("|").forEach((menu, idx) => {
                            const match = menu.match(/(.+?):\s*(\d+)\s*x\s*(\d+)\s*=\s*(\d+)/);
                            if (match) {
                                selectedMenus[match[1].trim()] = {
                                    noOfPlates: Number(match[2]),
                                    rate: Number(match[3]),
                                    total: Number(match[4]),
                                    extraPlates: Number(row.extraPlates || 0),
                                    selectedSubItems: [] // You can add subitems parsing if needed
                                };
                            }
                        });
                    }

                    // Construct final Firestore object
                    const leadData = {
                        name: row.name,
                        prefix: row.prefix,
                        mobile1: row.mobile1,
                        mobile2: row.mobile2,
                        enquiryDate: row.enquiryDate,
                        functionDate: row.functionDate,
                        functionType: row.functionType,
                        venueType: row.venueType,
                        noOfPlates: row.noOfPlates,
                        extraPlates: row.extraPlates,
                        hallCharges: row.hallCharges,
                        gstBase: row.gstBase,
                        gstAmount: row.gstAmount,
                        discount: row.discount,
                        grandTotal: row.grandTotal,
                        totalAmount: row.totalAmount,
                        startTime: row.startTime,
                        finishTime: row.finishTime,
                        eventBookedBy: row.eventBookedBy,
                        source: row.source,
                        note: row.note,
                        bookingAmenities,
                        meals: row.meals || {},
                        selectedMenus,
                        customItems,
                        customMenuCharges,
                        updatedAt: new Date()
                    };

                    const leadRef = doc(db, "prebookings", monthYear);
                    await setDoc(leadRef, { [leadId]: leadData }, { merge: true });
                    console.log(`Imported lead ${leadId}`);
                } catch (err) {
                    console.error("Error importing row:", err);
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    const formatMonthYear = (dateStr) => {
        if (!dateStr) return "Unknown";
        const d = new Date(dateStr);
        const month = d.toLocaleString("default", { month: "short" });
        const year = d.getFullYear();
        return `${month}${year}`;
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "usersAccess"), (querySnapshot) => {
            const mergedVenueColors = {};

            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                const colors = data.venueTypeColors || {};
                Object.assign(mergedVenueColors, colors); // merge all users' colors
            });

            setUserPermissions(prev => ({
                ...prev,
                venueTypeColors: mergedVenueColors
            }));
        }, (err) => console.error("Error fetching usersAccess:", err));

        return () => unsubscribe();
    }, []);

    return (
        <div className="leads-table-container">
            <div style={{ marginBottom: '30px' }}> <BackButton /> </div>
            <div className="table-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}> <h2 className="leads-header" style={{ margin: 0 }}>💒 Bookings</h2> </div>
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

            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '30px', flexWrap: 'wrap' }}>
                {/* Venue Type Legend */}
                <div style={{ textAlign: 'left' }} className="win-prob-legend">
                    <ul style={{ display: 'inline-block', listStyle: 'none', padding: 0, margin: 0 }}>
                        <li style={{ fontWeight: 'bold', marginBottom: '8px' }}>🎯 Venue Type :</li>
                        {[...Object.keys(userPermissions.venueTypeColors || {})].sort().concat("All Venues").map((type) => {
                            const isAll = type === "All Venues";

                            const currentColor = !isAll
                                ? userPermissions.venueTypeColors[type] || "#007BFF"
                                : "#3977a7ff"; // Gray for "All Venues"

                            return (
                                <li
                                    key={type}
                                    onClick={() => setVenueFilter(isAll ? "all" : type)}
                                    style={{
                                        cursor: "pointer",
                                        padding: "5px 12px",
                                        borderRadius: "6px",
                                        marginBottom: "6px",
                                        backgroundColor: venueFilter === (isAll ? "all" : type) ? currentColor : "#f0f0f0",
                                        color: venueFilter === (isAll ? "all" : type) ? "#fff" : "#000",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    {!isAll && (
                                        <span
                                            className="legend-box"
                                            style={{
                                                display: "inline-block",
                                                width: "12px",
                                                height: "12px",
                                                backgroundColor: currentColor,
                                                borderRadius: "3px",
                                            }}
                                        />
                                    )}
                                    {type}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Event Summary Table */}
                <div className='event-summary-container'>
                    <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '400px' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'center' }}>Event</th>
                                <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'center' }}>Cnt.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(eventCounts)
                                .sort((a, b) => b[1] - a[1])
                                .map(([event, count]) => (
                                    <tr key={event}>
                                        <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>{event}</td>
                                        <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'center' }}>{count}</td>
                                    </tr>
                                ))
                            }
                            <tr>
                                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontWeight: 'bold', color: 'red' }}>Total Events</td>
                                <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold', color: 'red' }}>
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

                    <div style={{ marginBottom: "10px", display: 'none' }}>
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleImport}
                            style={{ cursor: "pointer" }}
                        />
                    </div>

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
                                    <td colSpan={37} style={{ textAlign: 'center', backgroundColor: '#fdfdfdff', color: 'white', fontWeight: '800', fontSize: '15px', whiteSpace: 'nowrap' }}>
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
                                        <button style={{ backgroundColor: "#66363606", color: "#fff", border: "none", borderRadius: "4px", margin: '0 auto', display: 'flex', padding: '0px', justifyContent: 'center', opacity: 0 }}>
                                            <img
                                                src="../../assets/whatsappp.png"
                                                alt=""
                                                style={{ width: '0px', height: '28px' }}
                                            />
                                        </button>
                                    </th>
                                    <th style={{ fontSize: '21px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', opacity: 0 }} >  {'🖨️'} </div>
                                    </th>
                                    <th colSpan="32"></th>
                                </tr>
                            </thead>

                            <tbody>
                                {sortedLeads.map((lead, index) => (
                                    <tr
                                        key={lead.id}
                                        style={{
                                            whiteSpace: "nowrap",
                                            backgroundColor: userPermissions.venueTypeColors?.[lead.venueType] || "white",
                                            transition: "all 0.3s ease",
                                        }}
                                    >

                                        {['functionDate'].map((field) => (
                                            <td
                                                key={`${lead.id}-${field}`}
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    fontWeight: '700',
                                                    padding: '0px 2px 0px 5px',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                <>
                                                    {/* Function Date */}
                                                    {lead[field] ? formatDate(lead[field]) : '-'}

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
                                                        })()
                                                    }

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
                                                    padding: '0px 2px 0px 5px',
                                                    fontSize: '15px'
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
                                                            border: '2px solid #000000ff',
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
                                                                <td style={headerStyle}>Menu Name</td>
                                                                <td style={headerStyle}>Rate</td>
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
                                                                        color: 'transparent'
                                                                    }}
                                                                >
                                                                    <td style={cellStyle}>{menuName}</td>
                                                                    <td style={cellStyle}>
                                                                        {menuData.selectedSubItems && menuData.selectedSubItems.length > 0 ? (
                                                                            <button
                                                                                style={{
                                                                                    padding: '2px 6px',
                                                                                    fontSize: '12px',
                                                                                    backgroundColor: 'transparent',
                                                                                    borderRadius: 4,
                                                                                    cursor: 'pointer',
                                                                                    color: 'transparent'
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
                                                                        color: 'transparent'

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
                                                                                color: 'transparent'
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
                                                                        >
                                                                            <td style={{ ...headerStyle, color: 'transparent', backgroundColor: 'transparent' }}>Items</td>
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
                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px',
                                                                backgroundColor: 'transparent',
                                                                color: 'transparent'
                                                            }}
                                                        />
                                                    ) : (
                                                        lead[field] ?? ' '
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

                                        {/* 
// 
// 
*/}
                                        <td className="sticky sticky-1" style={{
                                            fontWeight: 'bold',
                                            backgroundColor: 'transparent',
                                            color: 'transparent'
                                        }}>{leads.length - index}.</td>

                                        <td className="sticky sticky-1" style={{
                                            fontWeight: 'bold',
                                            backgroundColor: 'transparent',
                                            color: 'transparent'
                                        }}>{leads.length - index}.</td>

                                        {['functionDate'].map((field, index) => (
                                            <>
                                                {field === 'functionDate' && (
                                                    <td style={{
                                                        backgroundColor: 'transparent',
                                                        color: 'transparent'
                                                    }}
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
                                                    textOverflow: 'ellipsis',
                                                    backgroundColor: 'transparent',
                                                    color: 'transparent'
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
                                                    textOverflow: 'ellipsis',
                                                    backgroundColor: 'transparent',
                                                    color: 'transparent'
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
                                                                backgroundColor: 'transparent',
                                                                color: 'transparent'
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
                                                                    textDecoration: 'none',
                                                                    cursor: 'pointer',
                                                                    fontWeight: 'bold',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    margin: '3px 0px',
                                                                    backgroundColor: 'transparent',
                                                                    color: 'transparent'
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
                                            <td style={{
                                                backgroundColor: 'transparent',
                                                color: 'transparent'
                                            }} key={`${lead.id}-${field}`}>
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
                                                            backgroundColor: 'transparent',
                                                            color: 'transparent'
                                                        }}
                                                    />
                                                ) : (
                                                    lead[field] !== undefined && lead[field] !== null
                                                        ? Math.floor(Number(lead[field])).toLocaleString('en-IN')
                                                        : '-'
                                                )}
                                            </td>
                                        ))}

                                        <td key={`${lead.id}-subtotal`}
                                            style={{
                                                backgroundColor: 'transparent',
                                                color: 'transparent'
                                            }}>
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
                                            <td style={{
                                                backgroundColor: 'transparent',
                                                color: 'transparent'
                                            }} key={`${lead.id}-${field}`} >
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
                                                            backgroundColor: 'transparent',
                                                            color: 'transparent'
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
                                            <td key={`${lead.id}-${field}`} style={{
                                                fontWeight: '800',
                                                backgroundColor: 'transparent',
                                                color: 'transparent'
                                            }}>
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

                                        < td style={{

                                            backgroundColor: 'transparent',
                                            color: 'transparent'
                                        }}>
                                            <div>
                                                ₹{lead.advancePayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0}
                                            </div>
                                            <div>
                                                <button
                                                    style={{
                                                        padding: "4px 8px", cursor: "pointer",

                                                        backgroundColor: 'transparent',
                                                        color: 'transparent'
                                                    }}
                                                >
                                                    View Advances
                                                </button>
                                            </div>
                                        </td>

                                        <td style={{

                                            backgroundColor: 'transparent',
                                            color: 'transparent'
                                        }}>
                                            ₹{Math.floor(
                                                (Number(lead.grandTotal) || 0) -
                                                (lead.advancePayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0) +
                                                (lead.refundPayments?.reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0)
                                            ).toLocaleString('en-IN')}
                                        </td>

                                        <td style={{

                                            backgroundColor: 'transparent',
                                            color: 'transparent'
                                        }}>
                                            ₹{(
                                                lead.advancePayments
                                                    ?.filter(adv => adv.mode === "Cash")
                                                    .reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0
                                            ).toLocaleString("en-IN")}
                                        </td>

                                        <td style={{

                                            backgroundColor: 'transparent',
                                            color: 'transparent'
                                        }}>
                                            ₹{(
                                                lead.advancePayments
                                                    ?.filter(adv => adv.mode !== "Cash")
                                                    .reduce((sum, adv) => sum + Number(adv.amount || 0), 0) || 0
                                            ).toLocaleString("en-IN")}
                                        </td>

                                        {['source'].map(field => (
                                            <td key={`${lead.id}-${field}`}
                                                style={{
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px',

                                                    backgroundColor: 'transparent',
                                                    color: 'transparent'
                                                }}
                                            >
                                                <div>
                                                    {isEditing(lead.id, field) ? (
                                                        <input
                                                            key={`${lead.id}-${field}-input`}
                                                            type={typeof lead[field] === 'number' ? 'number' : 'text'}
                                                            value={getLocalValue(lead.id, field, lead[field] || '')}
                                                            onBlur={() => handleBlur(lead.id, field)}
                                                            autoFocus
                                                            style={{
                                                                width: '100%',
                                                                boxSizing: 'border-box',
                                                                padding: '4px',
                                                                fontSize: 'inherit',
                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px',

                                                                backgroundColor: 'transparent',
                                                                color: 'transparent'
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
                                                        <small style={{

                                                            backgroundColor: 'transparent',
                                                            color: 'transparent'
                                                        }}>
                                                            By: <strong>{lead.referredBy || '—'}</strong>
                                                        </small>
                                                    </div>
                                                )}
                                            </td>
                                        ))}

                                        <td style={{ display: 'none' }} key={`${lead.id}-delete`}>
                                            <button
                                                style={{ backgroundColor: "#e74c3c", color: "#fff", border: "none", padding: "10px 15px", cursor: "pointer", zIndex: '-1' }} >  Cancel
                                            </button>
                                        </td>

                                        <td>
                                            {(lead.id) ? (
                                                <button style={{ backgroundColor: "transparent", color: "#fff", border: "none", borderRadius: "4px", margin: '0px', opacity: 0 }}>
                                                    <div style={{ fontSize: '21px' }} >✏️</div>
                                                </button>) : (
                                                ''
                                            )}
                                        </td>

                                        <td>
                                            <button style={{ backgroundColor: "transparent", border: "none", margin: '0px', display: 'flex', justifyContent: 'center', opacity: 0 }}>
                                                <img
                                                    src="../../assets/whatsappp.png"
                                                    alt=""
                                                    style={{ width: '30px', height: '30px' }}
                                                />
                                            </button>
                                        </td>

                                        <td>
                                            <button style={{ backgroundColor: "transparent", color: "#fff", border: "none", borderRadius: "4px", display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0 }}>
                                                <div style={{ fontSize: '21px' }}>🖨️</div>
                                            </button>
                                        </td>


                                        {['note'].map(field => (
                                            <td key={`${lead.id}-${field}`}
                                                style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px', color: 'transparent', backgroundColor: 'transparent' }}
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
                                                color: 'transparent', backgroundColor: 'transparent'
                                            }}
                                        >
                                            ₹{(
                                                lead.refundPayments?.reduce((sum, r) => sum + Number(r.amount || 0), 0) || 0
                                            ).toLocaleString("en-IN")}
                                        </td>

                                        <td key={`${lead.id}-bookingAmenities`}
                                            title={Array.isArray(lead.bookingAmenities) ? lead.bookingAmenities.join(', ') : ''}
                                            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px', color: 'transparent', backgroundColor: 'transparent' }}
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

                                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px', color: 'transparent', backgroundColor: 'transparent' }} >
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

                                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px', color: 'transparent', backgroundColor: 'transparent' }} >
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
                                                    textOverflow: 'ellipsis', color: 'transparent', backgroundColor: 'transparent'
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
                                            <td style={{ color: 'transparent', backgroundColor: 'transparent' }} key={`${lead.id}-${field}`} >
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
                                                            borderRadius: '4px', color: 'transparent', backgroundColor: 'transparent'
                                                        }}
                                                    />
                                                ) : (
                                                    lead[field] !== undefined && lead[field] !== null
                                                        ? Math.floor(Number(lead[field])).toLocaleString('en-IN')
                                                        : '0'
                                                )}
                                            </td>
                                        ))}

                                        <td style={{ color: 'transparent', backgroundColor: 'transparent' }}>{lead.id}</td>

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
                                sendToPrintPayment={sendToPrintPayment}
                                userPermissions={userPermissions}
                                sortConfig={sortConfig}
                                requestSort={requestSort}
                                alwayEdit={userPermissions.alwayEdit}
                                openExpenseModal={openExpenseModal}
                            />
                        </table>
                    </div>
                </div>

                {expenseModalOpen && (
                    <div className="expense-modal">
                        <div className="expense-modal-content">
                            <h3>💰 Add Event Expenses</h3>

                            <div className="expense-header">
                                <span>Item</span>
                                <span>Rate (₹)</span>
                            </div>

                            <div className="expense-list">
                                {eventExpenses.map((exp, i) => (
                                    <div key={i} className="expense-item">
                                        <div className="input-group">
                                            <label>Item</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Decoration"
                                                value={exp.item}
                                                onChange={(e) => {
                                                    const updated = [...eventExpenses];
                                                    updated[i].item = e.target.value;
                                                    setEventExpenses(updated);
                                                }}
                                            />
                                        </div>

                                        <div className="input-group">
                                            <label>Rate</label>
                                            <input
                                                type="number"
                                                placeholder="e.g. 5000"
                                                value={exp.rate}
                                                onWheel={(e) => e.target.blur()} // ✅ Prevent scroll value change
                                                onChange={(e) => {
                                                    const updated = [...eventExpenses];
                                                    updated[i].rate = e.target.value;
                                                    setEventExpenses(updated);
                                                }}
                                            />
                                        </div>

                                        <button
                                            className="remove-btn"
                                            onClick={() => {
                                                const updated = eventExpenses.filter((_, idx) => idx !== i);
                                                setEventExpenses(updated);
                                            }}
                                        >
                                            ✖
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                className="add-row-btn"
                                onClick={() => setEventExpenses([...eventExpenses, { item: "", rate: "" }])}
                            >
                                + Add Row
                            </button>

                            <div className="expense-modal-buttons">
                                <button className="save-btn" onClick={saveExpense}>Save</button>
                                <button className="cancel-btn" onClick={closeExpenseModal}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}



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