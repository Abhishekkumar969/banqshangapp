import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import '../../styles/BookingLeadsTable.css';
import Tbody from './Tbody';
import FilterPopupWrapper from './FilterPopupWrapper';
import BackButton from "../../components/BackButton";
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

const BookingLeadsTable = () => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [editingField, setEditingField] = useState({});
    const [editing, setEditing] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const location = useLocation();
    const [sortField, setSortField] = useState('functionDate');
    const [sortAsc, setSortAsc] = useState(false);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [availableFY, setAvailableFY] = useState([]);
    const [financialYear, setFinancialYear] = useState('');

    // for current fy year 
    // const [financialYear, setFinancialYear] = useState(null);

    const moveLeadToDrop = async (leadId, removeOriginal = false, reason = '', monthYear) => {
        try {
            const monthRef = doc(db, 'bookingLeads', monthYear);
            const monthSnap = await getDoc(monthRef);
            if (!monthSnap.exists()) return;

            const leadData = monthSnap.data()[leadId];

            // Save to dropLeads collection
            const dropRef = doc(db, 'dropLeads', leadId);
            await setDoc(dropRef, {
                ...leadData,
                droppedAt: new Date(),
                dropReason: reason || 'No reason provided'
            });

            if (removeOriginal) {
                // Delete the lead key from the month document
                await updateDoc(monthRef, { [leadId]: deleteField() });

                setLeads(prev => prev.filter(l => l.id !== leadId));
                setFilteredLeads(prev => prev.filter(l => l.id !== leadId));
            }

        } catch (error) {
            console.error('Error moving lead to dropLeads:', error);
        }
    };

    useEffect(() => {
        const trigger = location.state?.triggerPrint;
        const storedLead = localStorage.getItem('leadToPrint');

        if (trigger && storedLead) {
            setTimeout(() => {
                localStorage.removeItem('leadToPrint');
            }, 300);
        }
    }, [location.state]);

    useEffect(() => {
        const fetchLeads = async () => {
            const querySnapshot = await getDocs(collection(db, "bookingLeads"));
            let allLeads = [];

            querySnapshot.forEach(docSnap => {
                const monthData = docSnap.data();
                const monthLeads = Object.entries(monthData).map(([id, data]) => ({
                    id,
                    ...data,
                    monthYear: docSnap.id,
                }));
                allLeads.push(...monthLeads);
            });

            const sortedData = allLeads.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });

            setLeads(sortedData);
            setFilteredLeads(sortedData);
        };

        fetchLeads();
    }, []);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc); // toggle ascending/descending
        } else {
            setSortField(field);
            setSortAsc(true); // new field default ascending
        }
    };

    const sortedLeads = [...filteredLeads].sort((a, b) => {
        const dateA = new Date(a[sortField]) || new Date(0);
        const dateB = new Date(b[sortField]) || new Date(0);
        return sortAsc ? dateA - dateB : dateB - dateA;
    });

    const handleFilters = (filters) => {
        let filtered = [...leads];

        if (filters.winMin) {
            filtered = filtered.filter(l => Number(l.winProbability) >= Number(filters.winMin));
        }
        if (filters.winMax) {
            filtered = filtered.filter(l => Number(l.winProbability) <= Number(filters.winMax));
        }
        if (filters.followUpBefore) {
            filtered = filtered.filter(l => {
                const validDates = (l.followUpDates || []).filter(Boolean).sort();
                return validDates.length && validDates[0] <= filters.followUpBefore;
            });
        }
        if (filters.followUpAfter) {
            filtered = filtered.filter(l => {
                const validDates = (l.followUpDates || []).filter(Boolean).sort();
                return validDates.length && validDates[0] >= filters.followUpAfter;
            });
        }
        if (filters.contactSearch) {
            filtered = filtered.filter(l => l.mobile1?.toLowerCase().includes(filters.contactSearch.toLowerCase()));
        }
        if (filters.nameSearch) {
            filtered = filtered.filter(l => l.name?.toLowerCase().includes(filters.nameSearch.toLowerCase()));
        }
        if (filters.holdDateFrom) {
            filtered = filtered.filter(l => l.holdDate && l.holdDate >= filters.holdDateFrom);
        }
        if (filters.holdDateTo) {
            filtered = filtered.filter(l => l.holdDate && l.holdDate <= filters.holdDateTo);
        }
        if (filters.functionDateFrom) {
            filtered = filtered.filter(l => l.functionDate && l.functionDate >= filters.functionDateFrom);
        }
        if (filters.functionDateTo) {
            filtered = filtered.filter(l => l.functionDate && l.functionDate <= filters.functionDateTo);
        }

        setFilteredLeads(filtered);
    };

    const handleFieldChange = async (id, field, value) => {
        const lead = leads.find(l => l.id === id);
        if (!lead) return;

        const oldMonthYear = lead.monthYear;
        let newMonthYear = oldMonthYear;

        // Update monthYear if enquiryDate or functionDate changes
        if (field === "enquiryDate" || field === "functionDate") {
            const date = new Date(value);
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            // Match your Firestore doc names (e.g., "Sep2025")
            newMonthYear = `${monthNames[date.getMonth()]}${date.getFullYear()}`;
        }

        const updatedLead = { ...lead, [field]: value, monthYear: newMonthYear };

        // Update local state immediately
        setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
        setFilteredLeads(prev => prev.map(l => l.id === id ? updatedLead : l));

        console.log("Updating lead:", id);
        console.log("Old Month:", oldMonthYear, "New Month:", newMonthYear);

        try {
            const newMonthRef = doc(db, "bookingLeads", newMonthYear);
            const oldMonthRef = doc(db, "bookingLeads", oldMonthYear);

            if (oldMonthYear === newMonthYear) {
                console.log("Same month, just updating lead in Firestore");
                await updateDoc(newMonthRef, { [id]: updatedLead });
            } else {
                console.log("Different month, moving lead in Firestore");

                // 1️⃣ Write to new month
                await setDoc(newMonthRef, { [id]: updatedLead }, { merge: true });
                console.log("Lead written to new month:", newMonthYear);

                // 2️⃣ Delete from old month
                try {
                    await updateDoc(oldMonthRef, { [id]: deleteField() });
                    console.log("Lead deleted from old month:", oldMonthYear);
                } catch (err) {
                    console.warn(`Could not delete from old month (${oldMonthYear}):`, err);
                }
            }
        } catch (err) {
            console.error("Firestore update failed:", err);
        }

        // Close edit mode
        setEditingField(prev => ({
            ...prev,
            [id]: { ...(prev[id] || {}), [field]: false }
        }));
    };

    const handleDateChange = async (id, index, updatedFollowUp) => {
        const lead = leads.find(l => l.id === id);
        if (!lead) return;

        const updatedFollowUps = [...(lead.followUpDetails || [])];
        updatedFollowUps[index] = { ...updatedFollowUps[index], ...updatedFollowUp }; // merge updates

        try {
            const leadRef = doc(db, "bookingLeads", lead.monthYear);

            // Update only followUpDetails for this lead
            await updateDoc(leadRef, {
                [`${id}.followUpDetails`]: updatedFollowUps
            });

            // Update local state
            setLeads(prev =>
                prev.map(l => l.id === id ? { ...l, followUpDetails: updatedFollowUps } : l)
            );
            setFilteredLeads(prev =>
                prev.map(l => l.id === id ? { ...l, followUpDetails: updatedFollowUps } : l)
            );

            // Close edit mode
            setEditing(prev => ({
                ...prev,
                [id]: { ...prev[id], [index]: false }
            }));
        } catch (err) {
            console.error("Failed to update follow-up:", err);
        }
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

    const handlePrint = (lead) => {
        const amenitiesList = (lead.bookingAmenities || [])
            .map(item => `<li style="padding-left:40px">☑ ${item}</li>`)
            .join("");

        const selectedMenus = lead.menuSummaries || [];
        const hall = parseFloat(lead.hallCharges || 0);
        const gstPerMenu = (menu) => {
            const base = parseFloat(menu.gstBase);
            return !isNaN(base) ? (base * 0.18).toFixed(0) : '0';
        };

        const baseRates = {
            "Golden Veg": 1600,
            "Diamond Veg": 1750,
            "Golden Non Veg": 1700,
            "Diamond Non Veg": 1950,
        };

        const menuRows = selectedMenus.map(menu => {
            const menuName = menu.menuName;
            const menuData = lead.selectedMenus?.[menuName] || {};
            const customRate = menuData.rate;
            const baseRate = baseRates[menuName];
            const showStrike = baseRate && baseRate !== Number(customRate);

            return `
    <li style="display: flex; justify-content: space-between; padding-left: 40px; align-items: center; margin-bottom: 4px;">
        <span style="flex: 1;">• ${menuName} :</span>
        <div style="display: flex; gap: 10px; flex: 2; justify-content: flex-end; align-items: flex-end;">
            
            <!-- Rate Column -->
            <div style="display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 12px; margin-bottom: 2px;">Rate</div>
               <div style="border-bottom: 1px solid #000; width: 100px; text-align: center; color:red">
₹ ${showStrike
                    ? `<span style="text-decoration: line-through;">${Number(baseRate).toLocaleString('en-IN')}</span> 
       <span style="font-weight: bold;">${Number(customRate).toLocaleString('en-IN')}</span>`
                    : Number(customRate || 0).toLocaleString('en-IN')
                }
</div>
            </div>

            <span>X</span>

            <!-- Pax Column -->
            <div style="display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 12px; margin-bottom: 2px;">Pax</div>
               <div style="border-bottom: 1px solid #000; width: 40px; text-align: center;  color:red">
${Number(menuData.qty || 0).toLocaleString('en-IN')}
</div>
            </div>

            <span>=</span>

            <!-- Total -->
            <div style="display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 12px; margin-bottom: 2px;">Menu Total</div>
               <div style="border-bottom: 1px solid #000; width: 80px; text-align: center; background-color:yellow; color:red">
₹ ${Number(menu.menuTotal || 0).toLocaleString('en-IN')}
</div>
            </div>
        </div>
    </li>`;
        }).join("");

        let grandMealTotal = 0; // ⬅️ move outside so it can be used later

        const mealRows = (lead.meals && Object.keys(lead.meals).length > 0) ? (() => {

            const rows = Object.entries(lead.meals)
                .filter(([dayName, dayData]) =>
                    Object.entries(dayData).some(
                        ([mealName, mealInfo]) => mealName !== "date" && mealInfo?.total
                    )
                )
                .sort(([a], [b]) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")))
                .map(([dayName, dayData]) => {
                    const dayDate = dayData.date
                        ? new Date(dayData.date).toLocaleDateString("en-GB")
                        : "No date";

                    return `
        <li style="margin-bottom:15px; padding-left:40px;">
          <strong>${dayName} (${dayDate})</strong>
          <div style="display:flex; flex-direction:column; margin-top:5px; gap:5px;">
            ${Object.entries(dayData)
                            .filter(([mealName]) => mealName !== "date")
                            .map(([mealName, mealInfo]) => {
                                grandMealTotal += mealInfo?.total || 0; // add to grand total
                                return `
                  <div style="display:flex; justify-content:space-between; padding-left:10px;">
                    <div style="flex:1;">${mealName} <span style="color:red"> (${mealInfo.option}) </span> </div>
                    <div style="flex:1;">Rate: <span style="border-bottom: 1px solid #000; color:red">₹${mealInfo.rate}</span> 
                      X Pax: <span style="border-bottom: 1px solid #000; color:red">${mealInfo.pax}</span>
                    </div>
                  </div>`;
                            })
                            .join("")}
          </div>
        </li>`;
                }).join("");

            // Append grand total at the end, right-aligned with background only on amount
            return rows + `
<li style="padding: 0px; text-align:right; font-weight:bold; color:red">
  <span style="background-color:yellow; padding: 2px 8px; border-radius:4px; border-bottom: 1px solid #000">
    Meal Total: ₹${grandMealTotal}
  </span>
</li>`;

        })()
            : "";

        const mealSection = mealRows && mealRows.trim()
            ? `
            <div class="section">
              <strong>3. Meal Selected</strong>
              <ul>
                ${mealRows}
              </ul>
            </div>
          `
            : '';

        const gstSectionNumber = mealSection ? 4 : 3;

        // ✅ GST section ko conditional banao
        const gstSection =
            lead.gstBase && Number(lead.gstBase) > 0
                ? `
    <div class="section">
      <div style="display: flex; justify-content: space-between;">
        <strong>${gstSectionNumber}. GST on 
          <span style="color:red"> ₹ ${Number(lead.gstBase).toLocaleString('en-IN')}</span> @18%
        </strong>
        <strong style="background-color:yellow; color:red; border-bottom: 1px solid #000">
          ₹ ${Number(lead.gstAmount || 0).toLocaleString('en-IN')}
        </strong>
      </div>
    </div>`
                : ""; // ❌ show hi mat karo agar gstBase 0 hai

        // ✅ Grand total line me +GST hata diya
        const grandTotalLines = selectedMenus.map(menu => {
            const gst = gstPerMenu(menu);
            const total = hall + Number(menu.menuTotal) + Number(gst) + grandMealTotal;

            // agar meals section hai to text me "+ Meals" add karna hai
            const mealsText = mealSection ? " + Meals" : "";

            // agar GST hai to text me "+ GST" add karna hai
            const gstText = lead.gstBase && Number(lead.gstBase) > 0 ? " + GST" : "";

            return `
    <div style="display: flex; justify-content: space-between; margin-top: 4px">
        <span><strong>Grand Total 
          <span style="font-size:14px"> ( Venue Charges + ${menu.menuName} ${gstText} ${mealsText} ) </span> :
        </strong></span>
        <div style="border-bottom: 1px solid #000; width: 180px; text-align: center; background-color:yellow; font-weight:bold; color:red">
        ₹ ${Number(total).toLocaleString('en-IN')}
        </div>
    </div>`;
        }).join("");

        // Calculate strike price HTML
        const strikePriceHTML =
            lead.strikeHallCharges &&
                lead.hallCharges &&
                Number(lead.hallCharges) < Number(lead.strikeHallCharges)
                ? `<span style="text-decoration: line-through; color: #888; margin-right: 6px;">
                 ₹${Number(lead.strikeHallCharges).toLocaleString("en-IN")}
               </span>`
                : "";

        // Venue charges section for HTML
        const venueChargesHTML = `
        <div class="section">
          <div style="display: flex; justify-content: space-between;">
            <strong>1. Venue Charges - <span style="color:red" > ${lead.venueType} </span> :</strong>
            <div style="border-bottom: 1px solid #000; text-align: center;">
              ${strikePriceHTML}<span style="color:red ; font-weight:bold; background-color:yellow" >₹${Number(lead.hallCharges || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <ul>${amenitiesList}</ul>
        </div>
        `;

        const content = `
    <html>
    <head>
        <title>Booking Estimate_${lead.functionDate ? new Date(lead.functionDate).toLocaleDateString('en-GB').split('/').join('-') : ''}</title>
        <style>
            body { font-family: Arial; padding: 30px; line-height: 1.4; border: 2px solid red; color:#00054b }
            h2 { text-align: center; color: red; font-weight: bold; text-decoration: underline; font-size: 24px; }
            .section { margin-top: 15px; }
            .border-box {
                border: 2px solid red;
                padding: 10px;
                margin-bottom: 10px;
                margin-top: 5px;
                color: red;
            }
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                margin: 5px 15px;
            }
            .label { font-weight: bold; }
            ul { list-style: none; padding: 0; }
            li { margin-bottom: 6px; }
        </style>
    </head>
    <body>
        <h2>BOOKING ESTIMATE</h2>

<div class="border-box" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px;">
  
  <!-- Left Column -->
  <div style="flex: 1; min-width: 250px;">
    <div class="info-row">
      <span class="label">Name:</span>
      ${lead.prefix ? lead.prefix + ' ' : ''}${lead.name || '________'}
    </div>
    <div class="info-row">
      <span class="label">Mobile:</span>
      ${lead.mobile1
                ? lead.mobile1 + (lead.mobile2 ? ', ' + lead.mobile2 : '')
                : '________'
            }
    </div>
    <div class="info-row">
      <span class="label">Function Type:</span>
      ${lead.functionType || '________'}
    </div>
  </div>

  <!-- Right Column -->
  <div style="flex: 1; min-width: 250px;">
    <div class="info-row">
      <span class="label">Nos. of Pax:</span>
      ${lead.noOfPlates || '________'}
    </div>
    <div class="info-row">
      <span class="label">Date of Function:</span>
      ${lead.functionDate
                ? formatDate(lead.functionDate)
                : '________'}
    </div>
    <div class="info-row">
      <span class="label">Date of Enquiry:</span>
      ${lead.enquiryDate ? formatDate(lead.enquiryDate) : '-'}
    </div>
  </div>

       </div>

        <div class="section">
            <div style="display: flex; justify-content: space-between;">             
            </div>
            <ul>${venueChargesHTML}</ul>
        </div>

        <div class="section">
            <strong>2. Food Menu Selection</strong>
            <ul>${menuRows}</ul>
        </div>

        ${mealSection}

        ${gstSection}

        <div class="section" style="margin-top: 20px;">
            ${grandTotalLines}
        </div>

        <div class="section" style="margin-top: 30px;">
            <div>${lead?.authorisedSignatoryh || "Sales Team"}</div>
            <div style="border-bottom: 1px solid #000; width: 200px; margin-bottom: 5px;"></div>
            <div>Authorised Signature</div>
        </div>
        
    </body>
    </html>
    `;

        // ✅ hidden iframe banaya
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);

        // iframe ke andar HTML inject
        iframe.contentDocument.open();
        iframe.contentDocument.write(content);
        iframe.contentDocument.close();

        // print kar do
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // cleanup
        setTimeout(() => document.body.removeChild(iframe), 1000);

    };

    const handleWinFilter = (range) => {
        let [min, max] = range; // e.g., [0, 25]
        const filtered = leads.filter(l => {
            const wp = Number(l.winProbability) || 0;
            return wp >= min && wp <= max;
        });
        setFilteredLeads(filtered);
    };

    const leftRef = useRef(null);
    const rightRef = useRef(null);

    const getColumnColorClass = (value) => {
        const prob = parseFloat(value);
        if (isNaN(prob)) return '';
        if (prob < 25) return 'low-prob';
        if (prob < 50) return 'medium-prob';
        if (prob < 75) return 'high-prob';
        return 'very-high-prob';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year}`;
    };

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
        let filtered = [...leads];

        // From Date filter
        if (fromDate) {
            filtered = filtered.filter(lead =>
                lead.functionDate && new Date(lead.functionDate) >= new Date(fromDate)
            );
        }

        // To Date filter
        if (toDate) {
            filtered = filtered.filter(lead =>
                lead.functionDate && new Date(lead.functionDate) <= new Date(toDate)
            );
        }

        // Financial Year filter
        if (financialYear && financialYear !== "") {
            const [startYear, endYear] = financialYear.split("-").map(Number);
            const fyStart = new Date(Date.UTC(startYear, 3, 1)); // 1 April startYear
            const fyEnd = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59)); // 31 March endYear

            filtered = filtered.filter(lead => {
                const date = new Date(lead.functionDate);
                return date >= fyStart && date <= fyEnd;
            });
        }

        setFilteredLeads(filtered);
    }, [fromDate, toDate, financialYear, leads]);

    useEffect(() => {
        if (availableFY.length > 0 && financialYear === null) {
            setFinancialYear(getCurrentFinancialYear());
        }
    }, [availableFY, financialYear]);

    return (
        <div className="leads-table-container">
            <div style={{ marginBottom: '30px' }}> <BackButton />  </div>
            <div className="table-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, textAlign: 'center' }}> <h2 className="leads-header" style={{ margin: 0 }}>📋 Leads</h2> </div>
                <div> <FilterPopupWrapper onFilter={handleFilters} /> </div>
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
                    onClick={() => navigate('/bookingLead')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                    }}
                >
                    Create New Lead
                </button>
            </div>


            <div className="win-prob-legend">
                <strong>🎯 Lead Win Probability :</strong>
                <ul style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', listStyle: 'none', maxWidth: '330px', marginBottom: '0px', padding: '4px 5px', gap: '5px' }}>

                    <li style={{ backgroundColor: '#5ca7b8ff', color: '#000000ff', width: 'fit-content', borderRadius: '6px', cursor: 'pointer', padding: '4px 5px' }} onClick={() => setFilteredLeads(leads)} >
                        All </li>

                    <li style={{ backgroundColor: '#5cb85c', color: '#000000ff', width: 'fit-content', borderRadius: '6px', cursor: 'pointer', padding: '4px 5px' }} onClick={() => handleWinFilter([76, 100])} >
                        100% - 75% </li>

                    <li style={{ backgroundColor: '#ffff30', color: '#000000ff', width: 'fit-content', borderRadius: '6px', cursor: 'pointer', padding: '4px 5px' }} onClick={() => handleWinFilter([51, 75])} >
                        75% - 50%
                    </li>

                    <li style={{ backgroundColor: '#f0ad4e', color: '#000000ff', width: 'fit-content', borderRadius: '6px', cursor: 'pointer', padding: '4px 5px' }} onClick={() => handleWinFilter([26, 50])} >
                        50% - 25%
                    </li>

                    <li style={{ backgroundColor: '#d9534f', color: '#000000ff', width: 'fit-content', borderRadius: '6px', cursor: 'pointer', padding: '4px 5px' }} onClick={() => handleWinFilter([0, 25])} >
                        25% - 0%
                    </li>
                </ul>
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

                {/* Scrollable Table */}
                <div
                    className="table-scroll-container"
                    id="lead-table-scroll"
                    style={{
                        overflowX: 'auto',
                        scrollBehavior: 'smooth',
                        display: 'flex', gap: '2px'
                    }}
                >

                    {/* left table  */}
                    <div
                        ref={leftRef}
                        style={{ flex: '0 0 80px', overflowY: 'auto' }}
                        onScroll={() => { rightRef.current.scrollTop = leftRef.current.scrollTop; }}
                    >
                        <table className="leads-table">
                            <thead>
                                <tr style={{ whiteSpace: 'nowrap' }}>
                                    <th
                                        onClick={() => handleSort('functionDate')}
                                        style={{ cursor: 'pointer', padding: '0px' }}
                                    >
                                        Event Date {sortField === 'functionDate' ? (sortAsc ? '' : '') : ''}
                                    </th>
                                    <th>Name</th>
                                    <th colSpan="25"></th>
                                </tr>
                            </thead>

                            <tbody>
                                {sortedLeads.map((lead) => (
                                    <tr key={lead.id} className={getColumnColorClass(lead.winProbability)}>
                                        <td style={{ padding: '14px 0px', whiteSpace: 'nowrap', fontSize: '14px', fontWeight:'700' }}>
                                            {lead.functionDate ? formatDate(lead.functionDate) : ''}
                                        </td>

                                        <td>{lead.name || lead.partyName}</td>

                                        <td key={`${lead.id}-menu-details`} style={{ padding: '0px', flexDirection: 'column', gap: '5px', backgroundColor: 'transparent', color: 'transparent' }}>
                                            {lead.selectedMenus ? (
                                                <table
                                                    style={{
                                                        borderCollapse: 'collapse',
                                                        width: '100%',
                                                        whiteSpace: 'nowrap',
                                                        border: '2px solid #ffffff05' 
                                                    }}
                                                >
                                                    <thead>
                                                        {Object.entries(lead.selectedMenus).map(([menuName, data], idx) => (

                                                            <tr key={idx} className={getColumnColorClass(lead.winProbability)}>
                                                                <td style={{ padding: '5px 10px', border: '2px solid #ffffff0b', textAlign: 'left', backgroundColor: 'transparent', color: 'transparent', boxShadow:'none' }}>.</td>
                                                            </tr>
                                                        ))}
                                                    </thead>

                                                    <tbody>
                                                        {Object.entries(lead.selectedMenus).map(([menuName, data], idx) => (
                                                            <tr key={idx} className={getColumnColorClass(lead.winProbability)}>
                                                                <td style={{ padding: '5px 10px', border: '2px solid #ffffff01', boxShadow:'none' }}>{data.qty}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                "-"
                                            )}
                                        </td>

                                        <td key={`${lead.id}-meals`} style={{ backgroundColor: 'transparent', color: 'transparent' }} >
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
                                                                        border: "2px solid #ffffff03",
                                                                    }}
                                                                >
                                                                    <thead>
                                                                        <tr className={getColumnColorClass(lead.winProbability)}>

                                                                            <td
                                                                                colSpan={4}
                                                                                style={{
                                                                                    textAlign: "left",
                                                                                    padding: "2px 10px",
                                                                                    border: "1px solid #cccccc03",
                                                                                    color:'transparent' , boxShadow:'none'
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
                                                                            </td>
                                                                        </tr>
                                                                        <tr className={getColumnColorClass(lead.winProbability)}>

                                                                            <td style={{ padding: "2px 10px", border: "2px solid #ffffff09", color: 'transparent', boxShadow:'none' }}>x</td>
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
                                                                                return (
                                                                                    <tr key={mealIdx} className={getColumnColorClass(lead.winProbability)}>
                                                                                        <td style={{ padding: "5px 10px", border: "2px solid #ffffff00", whiteSpace: 'nowrap', boxShadow:'none' }}>
                                                                                            {mealInfo.pax} (PAX)
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

                                        <td key={`${lead.id}-mobiles`}>
                                            {isEditing(lead.id, 'mobile') ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {['mobile1', 'mobile2'].map((field) => (
                                                        <input
                                                            key={`${lead.id}-${field}-input`}
                                                            type="text"
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
                                                                    color: 'transparent',
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
                                                            <span style={{
                                                                color: 'transparent',
                                                                textDecoration: 'none',
                                                                cursor: 'pointer',
                                                                fontWeight: 'bold',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                            }} key={`${lead.id}-${field}`}>-</span>
                                                        )
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        {/* 
                                        // 
                                        // 
                                        // 
                                        */}


                                        <td style={{color:'transparent', whiteSpace:'nowrap'}}>
                                            {lead.enquiryDate ? formatDate(lead.enquiryDate) : '-'}
                                        </td>

                                        {['functionType', 'dayNight', 'venueType'].map(field => (
                                            <td key={`${lead.id}-${field}`} style={{ color: 'transparent' }}>
                                                {isEditing(lead.id, field) ? (
                                                    <input
                                                        type={typeof lead[field] === 'number' ? 'number' : 'text'}
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

                                        <td key={`${lead.id}-mobiles`} style={{color:'transparent',backgroundColor:'transparent'}}>
                                            {isEditing(lead.id, 'mobile') ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {['mobile1', 'mobile2'].map((field) => (
                                                        <input
                                                            key={`${lead.id}-${field}-input`}
                                                            type="text"

                                                            style={{
                                                                width: '100%',
                                                                boxSizing: 'border-box',
                                                                padding: '4px',
                                                                fontSize: 'inherit',

                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px',
                                                                color:'transparent'
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
                                                                    color: 'transparent',
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

                                        {['hallCharges', 'gstAmount', 'gstBase'].map(field => (
                                            <td key={`${lead.id}-${field}`} style={{color:'transparent',backgroundColor:'transparent'}} >
                                                {isEditing(lead.id, field) ? (
                                                    <input
                                                        key={`${lead.id}-${field}-input`}
                                                        type={typeof lead[field] === 'number' ? 'number' : 'text'}

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
                                                color:'transparent'
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

                                        <td > <button style={{ backgroundColor: "#2e75cc06", color: "#ffffff03", border: "none", padding: "10px 15px", borderRadius: "4px" }}> Update </button> </td>
                                        <td> <button style={{ backgroundColor: "#2ecc7002", color: "#ffffff04", border: "none", padding: "10px 15px", borderRadius: "4px", whiteSpace: 'nowrap' }}> Book Now </button> </td>
                                        <td><button style={{ backgroundColor: "#00725b05", color: "#ffffff04", border: "none", padding: "10px 15px", borderRadius: "4px" }}> Print </button> </td>

                                        <td key={`${lead.id}-bookingAmenities`}
                                            title={Array.isArray(lead.bookingAmenities) ? lead.bookingAmenities.join(', ') : ''}
                                            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '9000px',color:'transparent' }}
                                        >
                                            {isEditing(lead.id, 'bookingAmenities') ? (
                                                <input
                                                    key={`${lead.id}-bookingAmenities-input`}
                                                    type="text"

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
                                            <td key={`${lead.id}-${field}`} onClick={() => startEdit(lead.id, field)} style={{color:'transparent'}}>
                                                {isEditing(lead.id, field) ? (
                                                    <input
                                                        key={`${lead.id}-${field}-input`}
                                                        type="text"
                                                        placeholder="Win Probability"

                                                        autoFocus
                                                        style={{
                                                            width: '100%',
                                                            boxSizing: 'border-box',
                                                            padding: '4px',
                                                            fontSize: 'inherit',

                                                            border: '1px solid #ccc',
                                                            borderRadius: '4px',
                                                            color:'transparent'
                                                        }}
                                                    />
                                                ) : (
                                                    <div>{lead[field] ?? '-'}</div>
                                                )}
                                            </td>
                                        ))}

                                        <td key={`${lead.id}-holdDate`} onClick={() => startEdit(lead.id, 'holdDate')} style={{color:'transparent'}}>
                                            {isEditing(lead.id, 'holdDate') ? (
                                                <input
                                                    key={`${lead.id}-holdDate-input`}
                                                    type="date"

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
                                                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '6000rem',color:'transparent' }} key={`${lead.id}-followup-${index}`} onClick={() => handleEdit(lead.id, index)}>
                                                    {isActive ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <input
                                                                type="date"
                                                                style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="Enter remark"
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
                                            <td key={`${lead.id}-${field}`} style={{color:'transparent'}} >
                                                {isEditing(lead.id, field) ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <input
                                                            key={`${lead.id}-${field}-input`}
                                                            type="text"
                                                            placeholder="Source"
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
                                                            <div style={{ fontSize: '0.85em', color: '#88888804' }}>
                                                                • Reference: {lead.referredBy}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        ))}

                                        {['authorisedSignatory'].map(field => (
                                            <td key={`${lead.id}-${field}`} style={{color:'transparent'}} >
                                                {isEditing(lead.id, field) ? (
                                                    <input
                                                        key={`${lead.id}-${field}-input`}
                                                        type={typeof lead[field] === 'number' ? 'number' : 'text'}
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
                                    </tr>
                                ))}

                            </tbody>
                        </table>
                    </div>

                    {/* right table  */}
                    <div
                        ref={rightRef}
                        style={{ flex: 1, overflowY: 'auto' }}
                        onScroll={() => { leftRef.current.scrollTop = rightRef.current.scrollTop; }}
                    >
                        <table className="leads-table">
                            <thead>
                                <tr style={{ whiteSpace: 'nowrap' }}>
                                    {[
                                        'Sl',
                                    ].map(header => (
                                        <th key={header}>{header}</th>
                                    ))}

                                    {[
                                        'Name'
                                    ].map(header => (
                                        <th key={header}>{header}</th>
                                    ))}

                                    <th onClick={() => handleSort('enquiryDate')} style={{ cursor: 'pointer' }}>
                                        Enquiry Date {sortField === 'enquiryDate' ? (sortAsc ? '' : '') : ''}
                                    </th>

                                    {[
                                        'Month', 'Event', 'Day/Night', 'Venue Type', 'Contact Number',
                                        'Menu', 'Meal', 'Hall Charges', 'GST', 'Applicable GST', 'grandTotal', 'Edit',
                                        'Send to Bookings', 'Print', 'Extra Booking Amenities', 'Win Probability', 'Hold Up Date',
                                        'Follow Up Date 1', 'Follow Up Date 2', 'Follow Up Date 3', 'Follow Up Date 4',
                                        'Follow Up Date 5', 'Source Of Customer', "Booked By", 'Drop',
                                    ].map(header => (
                                        <th key={header}>{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <Tbody
                                leads={sortedLeads}
                                isEditing={isEditing}
                                editing={editing}
                                handleFieldChange={handleFieldChange}
                                handleEdit={handleEdit}
                                handleDateChange={handleDateChange}
                                startEdit={startEdit}
                                moveLeadToDrop={moveLeadToDrop}
                                handlePrint={handlePrint} />
                        </table>
                    </div>
                </div>

                {/* Left Scroll Button - Fixed on screen */}
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

                {/* Right Scroll Button - Fixed on screen */}
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

<style>
@page {
  size: A4;
  margin: 10mm;
}
body {
  font-family: Arial, sans-serif;
  padding: 10mm;
  color: #00054b;
}
</style>

export default BookingLeadsTable; 