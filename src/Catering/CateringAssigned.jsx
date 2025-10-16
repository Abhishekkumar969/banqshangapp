// src/pages/CateringAssign.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, onSnapshot, serverTimestamp, doc, setDoc } from "firebase/firestore";
import "../styles/VendorTable.css";
import BackButton from "../components/BackButton";

const CateringAssign = () => {
  const [caterings, setCaterings] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [popupBooking, setPopupBooking] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [moneyReceipts, setMoneyReceipts] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "catering"), (snap) => {
      const allBookings = [];

      snap.docs.forEach((doc) => {
        const monthDocId = doc.id; // e.g., "Apr2025"
        const monthData = doc.data().data || {}; // "data" map

        // Flatten bookings with month info
        Object.entries(monthData).forEach(([bookingId, booking]) => {
          allBookings.push({
            monthDocId,
            bookingId,
            ...booking,
          });
        });
      });

      setCaterings(allBookings);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "moneyReceipts"), (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMoneyReceipts(data);
    });

    return () => unsub();
  }, []);

  const handleInputChange = (bookingId, menuKey, field, value) => {
    setAssignments((prev) => {
      const current = prev[bookingId]?.[menuKey] || popupBooking.assignedMenus?.[menuKey] || popupBooking.customMenuCharges?.[menuKey] || {};
      return {
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          [menuKey]: {
            ...current,
            [field]: value,
          },
        },
      };
    });
  };

  const handleAssign = async (booking) => {
    try {
      const bookingAssign = assignments[booking.id] || {};

      // Assigned Menus
      const assignedMenus = {};
      Object.entries(booking.assignedMenus || {}).forEach(([menuKey, menuVal]) => {
        const assigned = bookingAssign[menuKey] || {};
        assignedMenus[menuKey] = {
          qty: assigned.qty ?? menuVal.qty ?? 0,
          extQty: assigned.extQty ?? menuVal.extQty ?? 0,
          rate: assigned.rate ?? menuVal.rate ?? 0,
        };
      });

      // Custom Menus
      const customMenuCharges = {};
      Object.entries(booking.customMenuCharges || {}).forEach(([menuKey, menuVal]) => {
        const assigned = bookingAssign[menuKey] || {};
        customMenuCharges[menuKey] = {
          qty: assigned.qty ?? menuVal.qty ?? 0,
          extQty: assigned.extQty ?? menuVal.extQty ?? 0,
          rate: assigned.rate ?? menuVal.rate ?? 0,
        };
      });

      // Meals
      const meals = {};
      Object.entries(booking.meals || {}).forEach(([dayName, dayMeals]) => {
        if (dayName === "No. of days" || dayName === "note") return;

        meals[dayName] = { ...dayMeals }; // keep date

        Object.entries(dayMeals)
          .filter(([mealName]) => mealName !== "date")
          .forEach(([mealName, mealDetails]) => {
            const assignedMeal = bookingAssign[`${dayName}-${mealName}`] || {};
            meals[dayName][mealName] = {
              ...mealDetails,
              pax: assignedMeal.qty ?? mealDetails.pax ?? 0,
              extQty: assignedMeal.extQty ?? mealDetails.extQty ?? 0,
              rate: assignedMeal.rate ?? mealDetails.rate ?? 0,
              total: ((assignedMeal.qty ?? mealDetails.pax ?? 0) + (assignedMeal.extQty ?? mealDetails.extQty ?? 0)) * (assignedMeal.rate ?? mealDetails.rate ?? 0),
            };
          });
      });

      await setDoc(
        doc(db, "catering", booking.id),
        {
          name: booking.name || "",
          eventDate: booking.eventDate || booking.functionDate || "",
          CateringAssignName: bookingAssign.CateringAssignName ?? booking.CateringAssignName ?? "",
          CateringAssignNumber: bookingAssign.CateringAssignNumber ?? booking.CateringAssignNumber ?? "",
          assignedMenus,
          customMenuCharges,
          meals,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPopupBooking(null);
    } catch (err) {
      console.error("Error assigning catering:", err);
      alert("❌ Failed to assign catering!");
    }
  };

  const filteredBookings = caterings.filter((booking) => {
    const nameMatch = booking.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const formattedDate = booking.eventDate
      ? new Date(booking.eventDate).toLocaleDateString("en-GB")
      : "";

    const formattedDateDashed = formattedDate.replace(/\//g, "-");

    const dateMatch =
      formattedDate.includes(searchTerm) || formattedDateDashed.includes(searchTerm);

    return nameMatch || dateMatch;
  });

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const dateA = new Date(a.eventDate || 0);
    const dateB = new Date(b.eventDate || 0);
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

  function calculateTotalPayOut(data) {
    if (!data) return 0;

    let total = 0;

    if (data.assignedMenus) {
      Object.values(data.assignedMenus).forEach(menu => {
        const qty = Number(menu.qty || 0);
        const ext = Number(menu.extQty || 0);
        const rate = Number(menu.rate || 0);
        total += (qty + ext) * rate;
      });
    }

    if (data.customMenuCharges) {
      Object.values(data.customMenuCharges).forEach(menu => {
        const qty = Number(menu.qty || 0);
        const ext = Number(menu.extQty || 0);
        const rate = Number(menu.rate || 0);
        total += (qty + ext) * rate;
      });
    }

    if (data.meals) {
      Object.values(data.meals).forEach(dayMeals => {
        Object.entries(dayMeals)
          .filter(([mealName]) => mealName !== "date")
          .forEach(([mealName, mealDetails]) => {
            const pax = Number(mealDetails.pax || 0);
            const ext = Number(mealDetails.extQty || 0);
            const rate = Number(mealDetails.rate || 0);
            total += (pax + ext) * rate;
          });
      });
    }

    return total;
  }

  function calculatePaidAmount(cateringName) {
    if (!cateringName) return 0;

    return moneyReceipts
      .filter(
        (receipt) =>
          receipt.particularNature &&
          receipt.particularNature.trim().toLowerCase() ===
          cateringName.trim().toLowerCase()
      )
      .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
  }

  const groupedBookings = sortedBookings.reduce((acc, booking) => {
    const nameKey = booking.CateringAssignName
      ? booking.CateringAssignName.trim().toLowerCase()
      : "No Catering Assigned";

    if (!acc[nameKey]) {
      acc[nameKey] = {
        name: booking.CateringAssignName || "No Catering Assigned",
        number: booking.CateringAssignNumber || "",
        bookings: []
      };
    }

    acc[nameKey].bookings.push(booking);
    return acc;
  }, {});

  return (
    <div className="vendor-table-container" style={{ padding: "40px 20px" }}>
      <BackButton />
      <h2>Catering Assignment</h2>

      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <input
          type="text"
          placeholder="Search by name or date (25-12-2025)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "8px 12px",
            width: "300px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      <div className="catering-table-wrapper">
        {Object.values(groupedBookings).map((group, gIdx) => {

          // ✅ Calculate total for this catering group
          const groupTotal = group.bookings.reduce((sum, booking) => {
            return sum + calculateTotalPayOut(booking);
          }, 0);
          return (
            <div key={gIdx} className="catering-table-wrapper" style={{ marginBottom: "50px" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "15px", // spacing between items
                  marginBottom: "20px",
                }}
              >
                <h3
                  style={{
                    fontWeight: "bold",
                    color: "black",
                    margin: 0,
                    flex: "1 1 100%", // full width on small screens
                  }}
                >
                  {group.name}{" "}
                  {group.number && (
                    <a
                      href={`tel:${group.number}`}
                      style={{ marginLeft: "10px", color: "darkblue", textDecoration: "none" }}
                    >
                      {group.number}
                    </a>
                  )}
                </h3>

                <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                  Total: ₹{groupTotal.toLocaleString("en-IN")}
                </span>
                <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                  Paid: ₹{calculatePaidAmount(group.name).toLocaleString("en-IN")}
                </span>
                <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                  Remaining: ₹{(groupTotal - calculatePaidAmount(group.name)).toLocaleString("en-IN")}
                </span>
              </div>


              <table className="main-vendor-table">
                <thead>
                  <tr>
                    <th colSpan={3}></th>
                    <th colSpan={4} style={{ textAlign: "center", backgroundColor: 'orange' }}>Menus</th>
                    <th colSpan={4} style={{ textAlign: "center", backgroundColor: 'gray' }}>Add On Items</th>
                    <th colSpan={5} style={{ textAlign: "center", backgroundColor: '#ff6f88' }}>Meals</th>
                    <th colSpan={4}></th>
                  </tr>
                </thead>
                <thead>
                  <tr>
                    <th>Sl</th>
                    <th onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} style={{ cursor: "pointer" }} > Event Date {sortOrder === "asc" ? "⬆" : "⬇"} </th>

                    <th>Venue Name</th>

                    <th style={{ textAlign: "center", backgroundColor: 'orange' }}>Menu Name</th>
                    <th style={{ textAlign: "center", backgroundColor: 'orange' }}>Pax Ordered</th>
                    <th style={{ textAlign: "center", backgroundColor: 'orange' }}>Extra Plate</th>
                    <th style={{ textAlign: "center", backgroundColor: 'orange' }}>Rate</th>

                    <th style={{ textAlign: "center", backgroundColor: 'gray' }}>Name</th>
                    <th style={{ textAlign: "center", backgroundColor: 'gray' }}>Pax Ordered</th>
                    <th style={{ textAlign: "center", backgroundColor: 'gray' }}>Extra Plate</th>
                    <th style={{ textAlign: "center", backgroundColor: 'gray' }}>Rate</th>

                    <th style={{ textAlign: "center", backgroundColor: '#ff6f88' }}>Name</th>
                    <th style={{ textAlign: "center", backgroundColor: '#ff6f88' }}>Option</th>
                    <th style={{ textAlign: "center", backgroundColor: '#ff6f88' }}>Pax Ordered</th>
                    <th style={{ textAlign: "center", backgroundColor: '#ff6f88' }}>Extra Plate</th>
                    <th style={{ textAlign: "center", backgroundColor: '#ff6f88' }}>Rate</th>

                    <th style={{ textAlign: "center", backgroundColor: '#3ec135ff' }}>Total Amount</th>
                    <th>Update</th>
                  </tr>
                </thead>

                <tbody>
                  {group.bookings.map((booking, idx) => (
                    <tr key={booking.id} >
                      <td>{group.bookings.length - idx}</td>
                      <td>
                        {booking.eventDate
                          ? new Date(booking.eventDate).toLocaleDateString("en-GB")
                          : ""}
                      </td>
                      <td>{booking.venueType}</td>

                      {/* Menus */}
                      <td>
                        {booking.assignedMenus
                          ? Object.entries(booking.assignedMenus).map(([menuKey], i) => (
                            <div key={i}><b>{menuKey}</b></div>
                          ))
                          : "No menus"}
                      </td>

                      {/* Pax */}
                      <td>
                        {booking.assignedMenus
                          ? Object.entries(booking.assignedMenus).map(([_, menuVal], i) => (
                            <div key={i}>{menuVal.qty}</div>
                          ))
                          : "No menus"}
                      </td>

                      {/* Extra Plate */}
                      <td>
                        {booking.assignedMenus
                          ? Object.entries(booking.assignedMenus).map(([_, menuVal], i) => (
                            <div key={i}>{menuVal.extQty}</div>
                          ))
                          : "No menus"}
                      </td>

                      {/* Rate */}
                      <td>
                        {booking.assignedMenus
                          ? Object.entries(booking.assignedMenus).map(([_, menuVal], i) => (
                            <div key={i}>{menuVal.rate}</div>
                          ))
                          : "No menus"}
                      </td>

                      {/* customMenuCharges menu name */}
                      <td>
                        {booking.customMenuCharges
                          ? Object.entries(booking.customMenuCharges).map(([menuKey, _], i) => (
                            <div key={i}>{menuKey}</div>
                          ))
                          : "No menus"}
                      </td>

                      {/* customMenuCharges qty */}
                      <td>
                        {booking.customMenuCharges
                          ? Object.entries(booking.customMenuCharges).map(([_, menuVal], i) => (
                            <div key={i}>{menuVal.qty}</div>
                          ))
                          : "No menus"}
                      </td>

                      {/* customMenuCharges extQty */}
                      <td>
                        {booking.customMenuCharges
                          ? Object.entries(booking.customMenuCharges).map(([_, menuVal], i) => (
                            <div key={i}>{menuVal.extQty}</div>
                          ))
                          : "No menus"}
                      </td>

                      {/* customMenuCharges rate */}
                      <td>
                        {booking.customMenuCharges
                          ? Object.entries(booking.customMenuCharges).map(([_, menuVal], i) => (
                            <div key={i}>{menuVal.rate}</div>
                          ))
                          : "No menus"}
                      </td>

                      {/* Meals name */}
                      <td>
                        {booking.meals ? (
                          Object.entries(booking.meals).map(([day, dayMeals]) => {
                            if (day === "No. of days") return null;

                            return (
                              <div key={day} style={{ marginBottom: "10px" }}>
                                <strong style={{ borderBottom: "1px dashed red" }}>
                                  {day} ({new Date(dayMeals.date).toLocaleDateString("en-GB")})
                                </strong>

                                {Object.entries(dayMeals).map(([mealName, mealDetails]) => {
                                  if (mealName === "date") return null;

                                  // ✅ Function to format HH:mm → 12hr AM/PM
                                  const formatTime = (timeStr) => {
                                    if (!timeStr) return "";
                                    const [hours, minutes] = timeStr.split(":");
                                    const d = new Date();
                                    d.setHours(hours, minutes);
                                    return d.toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    });
                                  };

                                  return (
                                    <div key={mealName} style={{ paddingLeft: "10px" }}>
                                      <b style={{ color: "red" }}>{mealName}</b>{" "}
                                      <span style={{ color: "black", fontSize: "12px" }}>
                                        ({formatTime(mealDetails.startTime)} - {formatTime(mealDetails.endTime)})
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        ) : (
                          "No meals"
                        )}
                      </td>

                      <td>
                        {booking.meals ? (
                          Object.entries(booking.meals).map(([day, dayMeals]) => {
                            if (day === "No. of days") return null;
                            return (
                              <div key={day} style={{ marginBottom: "10px" }}>
                                <strong> - </strong>
                                {Object.entries(dayMeals).map(([mealName, mealDetails]) => {
                                  if (mealName === "date") return null;
                                  return (
                                    <div key={mealName} style={{ paddingLeft: "10px" }}>
                                      <b>{mealDetails.option}</b>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        ) : (
                          "No meals"
                        )}
                      </td>

                      <td>
                        {booking.meals ? (
                          Object.entries(booking.meals).map(([day, dayMeals]) => {
                            if (day === "No. of days") return null;
                            return (
                              <div key={day} style={{ marginBottom: "10px" }}>
                                <strong> - </strong>
                                {Object.entries(dayMeals).map(([mealName, mealDetails]) => {
                                  if (mealName === "date") return null;
                                  return (
                                    <div key={mealName} style={{ paddingLeft: "10px" }}>
                                      Pax: {mealDetails.pax}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        ) : (
                          "No meals"
                        )}
                      </td>

                      <td>
                        {booking.meals ? (
                          Object.entries(booking.meals).map(([day, dayMeals]) => {
                            if (day === "No. of days") return null;
                            return (
                              <div key={day} style={{ marginBottom: "10px" }}>
                                <strong> - </strong>
                                {Object.entries(dayMeals).map(([mealName, mealDetails]) => {
                                  if (mealName === "date") return null;
                                  return (
                                    <div key={mealName} style={{ paddingLeft: "10px" }}>
                                      {mealDetails.extQty}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        ) : (
                          "No meals"
                        )}
                      </td>

                      <td>
                        {booking.meals ? (
                          Object.entries(booking.meals).map(([day, dayMeals]) => {
                            if (day === "No. of days") return null;
                            return (
                              <div key={day} style={{ marginBottom: "10px" }}>
                                <strong style={{ justifyContent: 'center' }}> - </strong>
                                {Object.entries(dayMeals).map(([mealName, mealDetails]) => {
                                  if (mealName === "date") return null;
                                  return (
                                    <div key={mealName} style={{ paddingLeft: "10px" }}>

                                      {mealDetails.rate}    {/* {" "}
                                <b style={{ color: "green" }}>
                                  Total: ₹{mealDetails.total}
                                </b> */}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        ) : (
                          "No meals"
                        )}
                      </td>

                      {/* Total */}
                      <td style={{ textAlign: "center", backgroundColor: '#3ec135ff', fontWeight: 'bold', fontSize: '16px' }}>₹ {calculateTotalPayOut(booking).toLocaleString("en-IN")}</td>

                      {/* Action */}
                      <td>
                        <button
                          onClick={() => {
                            setAssignments((prev) => ({
                              ...prev,
                              [booking.id]: booking.assignedMenus || {},
                            }));
                            setPopupBooking(booking);
                          }}
                          className={`assign-btn ${booking.assignedMenus &&
                            Object.keys(booking.assignedMenus).length > 0
                            ? "update-btn"
                            : "new-assign-btn"
                            }`}
                        >
                          {booking.assignedMenus &&
                            Object.keys(booking.assignedMenus).length > 0
                            ? "Update"
                            : "Assign"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>


      {popupBooking && (
        <div className="modal-overlay" onClick={() => setPopupBooking(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">🍽 Assign Catering</h2>

            {/* Name & Number */}
            <div className="menus-container">
              <h3>Catering Details :</h3>
              <div className="field">
                <label>Name</label>
                <input
                  type="text"
                  value={assignments[popupBooking.id]?.CateringAssignName || popupBooking.CateringAssignName || ""}
                  onChange={(e) =>
                    handleInputChange(popupBooking.id, "CateringAssignName", "value", e.target.value)
                  }
                />
              </div>
              <div className="field">
                <label>Number</label>
                <input
                  type="text"
                  value={assignments[popupBooking.id]?.CateringAssignNumber || popupBooking.CateringAssignNumber || ""}
                  onChange={(e) =>
                    handleInputChange(popupBooking.id, "CateringAssignNumber", "value", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Assigned Menus */}
            {popupBooking.assignedMenus && Object.keys(popupBooking.assignedMenus).length > 0 && (
              <div className="menus-container" >
                <h3>Assigned Menus</h3>
                {Object.entries(popupBooking.assignedMenus).map(([menuKey, menuVal], i) => {
                  const assigned = assignments[popupBooking.id]?.[menuKey] || menuVal || {};
                  return (
                    <div key={`assigned-${i}`} className="menu-block">
                      <h4 className="menu-name">{menuKey}</h4>
                      <div className="menu-fields">
                        <div className="field">
                          <label>Pax</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={assigned.qty || ""}
                            onChange={(e) =>
                              handleInputChange(
                                popupBooking.id,
                                menuKey,
                                "qty",
                                e.target.value.replace(/[^0-9]/g, "")
                              )
                            }
                          />
                        </div>
                        <div className="field">
                          <label>Extra Plates</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={assigned.extQty || ""}
                            onChange={(e) =>
                              handleInputChange(
                                popupBooking.id,
                                menuKey,
                                "extQty",
                                e.target.value.replace(/[^0-9]/g, "")
                              )
                            }
                          />
                        </div>
                        <div className="field">
                          <label>Rate (₹)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={assigned.rate || ""}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9.]/g, "");
                              if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                              handleInputChange(popupBooking.id, menuKey, "rate", val);
                            }}
                          />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Menus */}
            {popupBooking.customMenuCharges && Object.keys(popupBooking.customMenuCharges).length > 0 && (
              <div className="menus-container">
                <h3>Custom Menus</h3>
                {Object.entries(popupBooking.customMenuCharges).map(([menuKey, menuVal], j) => {
                  const assigned = assignments[popupBooking.id]?.[menuKey] || menuVal || {};
                  return (
                    <div key={`custom-${j}`} className="menu-block">
                      <h4 className="menu-name">{menuKey}</h4>
                      <div className="menu-fields">
                        <div className="field">
                          <label>Pax</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={assigned.qty || ""}
                            onChange={(e) =>
                              handleInputChange(popupBooking.id, menuKey, "qty", e.target.value.replace(/[^0-9]/g, ""))
                            }
                          />
                        </div>
                        <div className="field">
                          <label>Extra Plates</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={assigned.extQty || ""}
                            onChange={(e) =>
                              handleInputChange(popupBooking.id, menuKey, "extQty", e.target.value.replace(/[^0-9]/g, ""))
                            }
                          />
                        </div>
                        <div className="field">
                          <label>Rate (₹)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={assigned.rate || ""}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9.]/g, "");
                              if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                              handleInputChange(popupBooking.id, menuKey, "rate", val);
                            }}
                          />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {popupBooking.meals && Object.keys(popupBooking.meals).length > 0 && (
              <div className="menus-container">
                <h3>Meals</h3>

                {Object.entries(popupBooking.meals)
                  .filter(([key]) => key !== "No. of days" && key !== "note")
                  .map(([dayName, dayMeals], dayIdx) => (
                    <div key={dayIdx} className="menu-block">
                      <h4>
                        {dayName} (
                        {dayMeals.date
                          ? new Date(dayMeals.date).toLocaleDateString("en-GB")
                          : ""}
                        )
                      </h4>

                      {/* Meals for that day */}
                      {Object.entries(dayMeals)
                        .filter(([mealName]) => mealName !== "date")
                        .map(([mealName, mealDetails], mealIdx) => {
                          const assigned =
                            assignments[popupBooking.id]?.[`${dayName}-${mealName}`] || {};

                          return (
                            <div
                              key={mealIdx}
                              className="menu-fields"
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                marginBottom: "15px",
                                border: "1px solid #ddd",
                                borderRadius: "5px",
                                backgroundColor: "#f9f9f9",
                                padding: "10px",
                              }}
                            >
                              {/* Meal Name and Option */}
                              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                                {mealName} | Option: {mealDetails.option}
                              </div>

                              {/* Pax / Extra Plates / Rate in one row */}
                              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                                  <label>Pax</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assigned.qty ?? mealDetails.pax ?? ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        popupBooking.id,
                                        `${dayName}-${mealName}`,
                                        "qty",
                                        e.target.value.replace(/[^0-9]/g, "")
                                      )
                                    }
                                    style={{ width: "100%", padding: "5px" }}
                                  />
                                </div>

                                <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                                  <label>Extra Plates</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={assigned.extQty ?? ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        popupBooking.id,
                                        `${dayName}-${mealName}`,
                                        "extQty",
                                        e.target.value.replace(/[^0-9]/g, "")
                                      )
                                    }
                                    style={{ width: "100%", padding: "5px" }}
                                  />
                                </div>

                                <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                                  <label>Rate (₹)</label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={assigned.rate ?? mealDetails.rate ?? ""}
                                    onChange={(e) => {
                                      let val = e.target.value.replace(/[^0-9.]/g, "");
                                      if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                      handleInputChange(
                                        popupBooking.id,
                                        `${dayName}-${mealName}`,
                                        "rate",
                                        val
                                      );
                                    }}
                                    style={{ width: "100%", padding: "5px" }}
                                  />
                                </div>
                              </div>

                            </div>
                          );
                        })}
                    </div>
                  ))}
              </div>
            )}

            {/* If nothing */}
            {!(
              (popupBooking.assignedMenus && Object.keys(popupBooking.assignedMenus).length > 0) ||
              (popupBooking.customMenuCharges && Object.keys(popupBooking.customMenuCharges).length > 0)
            ) && <p className="no-menus">No menus available</p>}

            <div className="modal-actions">
              <button className="btn save" onClick={() => handleAssign(popupBooking)}>
                {(popupBooking.assignedMenus && Object.keys(popupBooking.assignedMenus).length > 0) ||
                  (popupBooking.customMenuCharges && Object.keys(popupBooking.customMenuCharges).length > 0)
                  ? "🔄 Update"
                  : "💾 Save"}
              </button>
              <button className="btn cancel" onClick={() => setPopupBooking(null)}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default CateringAssign;
