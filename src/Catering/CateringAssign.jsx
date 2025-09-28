// src/pages/CateringAssign.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { collection, onSnapshot, serverTimestamp, doc, setDoc } from "firebase/firestore";
import "../styles/VendorTable.css";
import BackButton from "../components/BackButton";
import { useNavigate } from "react-router-dom";

const CateringAssign = () => {
    const [prebookings, setPrebookings] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [popupBooking, setPopupBooking] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("desc");
    const navigate = useNavigate();

    useEffect(() => {
        const unsubPrebookings = onSnapshot(collection(db, "prebookings"), (prebookSnap) => {
            const prebookingData = prebookSnap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setPrebookings((prev) =>
                prebookingData.map((booking) => ({
                    ...booking,
                    assignedMenus: prev.find((b) => b.id === booking.id)?.assignedMenus || {},
                }))
            );
        });

        const unsubCatering = onSnapshot(collection(db, "catering"), (cateringSnap) => {
            const cateringData = cateringSnap.docs.reduce((acc, doc) => {
                acc[doc.id] = doc.data();
                return acc;
            }, {});
            setPrebookings((prev) =>
                prev.map((booking) => ({
                    ...booking,
                    assignedMenus: cateringData[booking.id]?.assignedMenus || {},
                }))
            );
        });

        return () => {
            unsubPrebookings();
            unsubCatering();
        };
    }, []);

    const handleInputChange = (bookingId, menuKey, field, value) => {
        setAssignments((prev) => ({
            ...prev,
            [bookingId]: {
                ...prev[bookingId],
                [menuKey]: {
                    ...prev[bookingId]?.[menuKey],
                    [field]: value,
                },
            },
        }));
    };

    const handleAssign = async (booking) => {
        try {
            const bookingAssign = assignments[booking.id] || {};

            const assignedMenus = {};
            Object.entries(booking.selectedMenus || {}).forEach(([menuKey, menuVal]) => {
                const assigned = bookingAssign[menuKey] || {};
                assignedMenus[menuKey] = {
                    qty: assigned.qty ?? menuVal.qty ?? 0,
                    extQty: assigned.extQty ?? menuVal.extQty ?? 0,
                    rate: assigned.rate ?? menuVal.rate ?? 0,
                };
            });

            const customMenuCharges = {};
            (booking.customMenuCharges || []).forEach((menu, i) => {
                const assigned = bookingAssign[`custom-${i}`] || {};
                customMenuCharges[menu.name] = {
                    qty: assigned.qty ?? menu.qty ?? 0,
                    extQty: assigned.extQty ?? menu.extQty ?? 0,
                    rate: assigned.rate ?? menu.rate ?? 0,
                };
            });

            // Prepare meals data for Firestore
            const mealsData = {};
            Object.entries(booking.meals || {}).forEach(([day, dayMeals]) => {
                if (day === "No. of days") return; // skip
                mealsData[day] = {};
                Object.entries(dayMeals).forEach(([mealName, mealDetails]) => {
                    if (mealName === "date") {
                        mealsData[day].date = mealDetails; // keep date
                    } else {
                        const assigned = bookingAssign[`${day}-${mealName}`] || {};
                        mealsData[day][mealName] = {
                            option: mealDetails.option ?? "",
                            pax: assigned.qty ?? mealDetails.pax ?? 0,
                            extQty: assigned.extQty ?? mealDetails.extQty ?? 0,
                            rate: assigned.rate ?? mealDetails.rate ?? 0,
                            startTime: mealDetails.startTime ?? "",
                            endTime: mealDetails.endTime ?? "",
                            total: mealDetails.total ?? 0,
                        };
                    }
                });
            });

            await setDoc(
                doc(db, "catering", booking.id),
                {   
                    functionType: booking.functionType || "",
                    venueType: booking.venueType || "",
                    assignedMenus,
                    customMenuCharges,
                    meals: mealsData,
                    eventDate: booking.functionDate || "",
                    name: booking.name || "",
                    CateringAssignName:
                        bookingAssign?.general?.CateringAssignName ||
                        booking.CateringAssignName ||
                        "",
                    CateringAssignNumber:
                        bookingAssign?.general?.CateringAssignNumber ||
                        booking.CateringAssignNumber ||
                        "",
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            navigate("/cateringAssigned");
            setPopupBooking(null);
        } catch (err) {
            console.error("Error assigning catering:", err);
            alert("❌ Failed to assign catering!");
        }
    };

    const filteredBookings = prebookings
        .filter(
            (booking) =>
                !booking.assignedMenus || Object.keys(booking.assignedMenus).length === 0
        )
        .filter((booking) => {
            const nameMatch = booking.name?.toLowerCase().includes(searchTerm.toLowerCase());
            const formattedDate = booking.functionDate
                ? new Date(booking.functionDate).toLocaleDateString("en-GB")
                : "";
            const formattedDateDashed = formattedDate.replace(/\//g, "-");
            const dateMatch =
                formattedDate.includes(searchTerm) || formattedDateDashed.includes(searchTerm);
            return nameMatch || dateMatch;
        });

    const sortedBookings = [...filteredBookings].sort((a, b) => {
        const dateA = new Date(a.functionDate || 0);
        const dateB = new Date(b.functionDate || 0);
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return (
        <div className="vendor-table-container" style={{ padding: "40px 20px" }}>
            <BackButton />
            <h2>Catering Assignment</h2>

            {/* 🔎 Search Bar */}
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
                <table className="main-vendor-table">
                    <thead>
                        <tr>
                            <th>Sr No</th>
                            <th>Name</th>
                            <th
                                onClick={() =>
                                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                                }
                                style={{ cursor: "pointer" }}
                            >
                                Event Date {sortOrder === "asc" ? "⬆" : "⬇"}
                            </th>
                            <th>Selected Menus</th>
                            <th>Custom Menu</th>
                            <th>Meal</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedBookings.map((booking, idx) => (
                            <tr key={booking.id}>
                                <td>{sortedBookings.length - idx}</td>
                                <td>{booking.name}</td>
                                <td>
                                    {booking.functionDate
                                        ? new Date(booking.functionDate).toLocaleDateString(
                                            "en-GB"
                                        )
                                        : ""}
                                </td>
                                <td>
                                    {booking.selectedMenus
                                        ? Object.entries(booking.selectedMenus).map(
                                            ([menuKey, menuVal], i) => (
                                                <div key={i}>
                                                    <b>{menuKey}</b> | Qty: {menuVal.qty} | Rate:
                                                    ₹{menuVal.rate}
                                                </div>
                                            )
                                        )
                                        : "No menus"}
                                </td>
                                <td>
                                    {booking.customMenuCharges &&
                                        booking.customMenuCharges.length > 0 ? (
                                        booking.customMenuCharges.map((menuVal, i) => (
                                            <div key={i}>
                                                <b>{menuVal.name}</b> | Qty: {menuVal.qty} | Rate:
                                                ₹{menuVal.rate}
                                            </div>
                                        ))
                                    ) : (
                                        ""
                                    )}
                                </td>

                                <td>
                                    {booking.meals ? (
                                        <>
                                            {Object.entries(booking.meals).map(([day, dayMeals]) => {
                                                if (day === "No. of days") return null;
                                                return (
                                                    <div key={day} style={{ marginBottom: "10px" }}>

                                                        <strong style={{ borderBottom: '1px dashed red', marginBottom: '5px' }}>
                                                            {day} (
                                                            {(() => {
                                                                const d = new Date(dayMeals.date);
                                                                const day = String(d.getDate()).padStart(2, '0');
                                                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                                                const year = d.getFullYear();
                                                                return `${day}-${month}-${year}`;
                                                            })()}
                                                            ):
                                                        </strong>

                                                        {Object.entries(dayMeals).map(([mealName, mealDetails]) => {
                                                            if (mealName === "date") return null;
                                                            return (
                                                                <div key={mealName} style={{ paddingLeft: "10px" }}>
                                                                    <b style={{ color: 'red' }} >{mealName}</b> | <b> {mealDetails.option} </b> | Pax: <b> {mealDetails.pax} </b> |
                                                                    Rate: <b> ₹{mealDetails.rate} </b> | Start: <b> {mealDetails.startTime} </b> | End: <b> {mealDetails.endTime} </b> |
                                                                    <b style={{ color: 'green' }} >  Total: ₹{mealDetails.total} </b>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        "No meals"
                                    )}
                                </td>

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

            {/* Modal */}
            {/* Modal */}
            {popupBooking && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="modal-title">🍽 Assign Catering</h2>

                        {/* ✅ Name + Number */}
                        <div className="menu-block">
                            <div className="menu-fields">
                                <div className="field">
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        value={
                                            assignments[popupBooking.id]?.general
                                                ?.CateringAssignName ||
                                            popupBooking.CateringAssignName ||
                                            ""
                                        }
                                        onChange={(e) =>
                                            handleInputChange(
                                                popupBooking.id,
                                                "general",
                                                "CateringAssignName",
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>
                                <div className="field">
                                    <label>Number</label>
                                    <input
                                        type="number"
                                        value={
                                            assignments[popupBooking.id]?.general
                                                ?.CateringAssignNumber ||
                                            popupBooking.CateringAssignNumber ||
                                            ""
                                        }
                                        onChange={(e) =>
                                            handleInputChange(
                                                popupBooking.id,
                                                "general",
                                                "CateringAssignNumber",
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ✅ Selected Menus */}
                        {popupBooking.selectedMenus && Object.keys(popupBooking.selectedMenus).length > 0 && (
                            <div className="menus-container">
                                <h3>Selected Menus</h3>
                                {Object.entries(popupBooking.selectedMenus).map(
                                    ([menuKey, menuVal]) => {
                                        const assigned =
                                            assignments[popupBooking.id]?.[menuKey] || {};
                                        return (
                                            <div key={menuKey} className="menu-block">
                                                <h4 className="menu-name">{menuKey}</h4>
                                                <div className="menu-fields">
                                                    <div className="field">
                                                        <label>Pax</label>
                                                        <input
                                                            type="number"
                                                            value={
                                                                assigned.qty ?? menuVal.qty ?? ""
                                                            }
                                                            onChange={(e) =>
                                                                handleInputChange(
                                                                    popupBooking.id,
                                                                    menuKey,
                                                                    "qty",
                                                                    e.target.value === ""
                                                                        ? ""
                                                                        : Number(e.target.value)
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="field">
                                                        <label>Extra Plates</label>
                                                        <input
                                                            type="number"
                                                            value={assigned.extQty ?? ""}
                                                            onChange={(e) =>
                                                                handleInputChange(
                                                                    popupBooking.id,
                                                                    menuKey,
                                                                    "extQty",
                                                                    e.target.value === ""
                                                                        ? ""
                                                                        : Number(e.target.value)
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="field">
                                                        <label>Rate (₹)</label>
                                                        <input
                                                            type="number"
                                                            value={assigned.rate ?? menuVal.rate ?? ""}
                                                            onChange={(e) =>
                                                                handleInputChange(
                                                                    popupBooking.id,
                                                                    menuKey,
                                                                    "rate",
                                                                    e.target.value === ""
                                                                        ? ""
                                                                        : Number(e.target.value)
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        )}

                        {/* ✅ Custom Menus */}
                        {popupBooking.customMenuCharges && popupBooking.customMenuCharges.length > 0 && (
                            <div className="menus-container">
                                <h3>Custom Menus</h3>
                                {popupBooking.customMenuCharges.map((menuVal, i) => {
                                    const assigned =
                                        assignments[popupBooking.id]?.[`custom-${i}`] || {};
                                    return (
                                        <div key={`custom-${i}`} className="menu-block">
                                            <h4 className="menu-name">{menuVal.name}</h4>
                                            <div className="menu-fields">
                                                <div className="field">
                                                    <label>Pax</label>
                                                    <input
                                                        type="number"
                                                        value={assigned.qty ?? menuVal.qty ?? ""}
                                                        onChange={(e) =>
                                                            handleInputChange(
                                                                popupBooking.id,
                                                                `custom-${i}`,
                                                                "qty",
                                                                e.target.value === ""
                                                                    ? ""
                                                                    : Number(e.target.value)
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <div className="field">
                                                    <label>Extra Plates</label>
                                                    <input
                                                        type="number"
                                                        value={assigned.extQty ?? ""}
                                                        onChange={(e) =>
                                                            handleInputChange(
                                                                popupBooking.id,
                                                                `custom-${i}`,
                                                                "extQty",
                                                                e.target.value === ""
                                                                    ? ""
                                                                    : Number(e.target.value)
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <div className="field">
                                                    <label>Rate (₹)</label>
                                                    <input
                                                        type="number"
                                                        value={assigned.rate ?? menuVal.rate ?? ""}
                                                        onChange={(e) =>
                                                            handleInputChange(
                                                                popupBooking.id,
                                                                `custom-${i}`,
                                                                "rate",
                                                                e.target.value === ""
                                                                    ? ""
                                                                    : Number(e.target.value)
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ✅ Custom Meals */}
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
                                                                flexWrap: "wrap",
                                                                gap: "15px",
                                                                marginBottom: "15px",
                                                                borderRadius: "5px",
                                                                backgroundColor: "#f9f9f9",
                                                                alignItems: "center",
                                                            }}
                                                        >
                                                            {/* Meal Name */}
                                                            <div style={{ flex: "1 1 100%", marginBottom: "5px" }}>
                                                                <strong>{mealName}</strong> | Option: {mealDetails.option}
                                                            </div>

                                                            {/* Inputs in a row */}
                                                            <div style={{ display: "flex", flex: "1 1 100%", gap: "10px", flexWrap: "wrap" }}>
                                                                <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                                                                    <label>Pax</label>
                                                                    <input
                                                                        type="number"
                                                                        value={assigned.qty ?? mealDetails.pax ?? ""}
                                                                        onChange={(e) =>
                                                                            handleInputChange(
                                                                                popupBooking.id,
                                                                                `${dayName}-${mealName}`,
                                                                                "qty",
                                                                                e.target.value === "" ? "" : Number(e.target.value)
                                                                            )
                                                                        }
                                                                        style={{ width: "100%", padding: "5px" }}
                                                                    />
                                                                </div>

                                                                <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                                                                    <label>Extra Plates</label>
                                                                    <input
                                                                        type="number"
                                                                        value={assigned.extQty ?? ""}
                                                                        onChange={(e) =>
                                                                            handleInputChange(
                                                                                popupBooking.id,
                                                                                `${dayName}-${mealName}`,
                                                                                "extQty",
                                                                                e.target.value === "" ? "" : Number(e.target.value)
                                                                            )
                                                                        }
                                                                        style={{ width: "100%", padding: "5px" }}
                                                                    />
                                                                </div>

                                                                <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                                                                    <label>Rate (₹)</label>
                                                                    <input
                                                                        type="number"
                                                                        value={assigned.rate ?? mealDetails.rate ?? ""}
                                                                        onChange={(e) =>
                                                                            handleInputChange(
                                                                                popupBooking.id,
                                                                                `${dayName}-${mealName}`,
                                                                                "rate",
                                                                                e.target.value === "" ? "" : Number(e.target.value)
                                                                            )
                                                                        }
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

                        <div className="modal-actions">
                            <button
                                className="btn save"
                                onClick={() => handleAssign(popupBooking)}
                            >
                                {popupBooking.assignedMenus &&
                                    Object.keys(popupBooking.assignedMenus).length > 0
                                    ? "🔄 Update"
                                    : "💾 Save"}
                            </button>
                            <button
                                className="btn cancel"
                                onClick={() => setPopupBooking(null)}
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CateringAssign;
