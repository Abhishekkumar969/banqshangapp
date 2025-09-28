import React, { forwardRef, useState, useEffect, useImperativeHandle } from "react";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import "../styles/MealSelection.css";

const mealOptions = ["Breakfast", "Lunch", "Dinner"];

const MealSelection = forwardRef(({ meals, setMeals, functionDate, dayNight }, ref) => {
    const [numDays, setNumDays] = useState(1);
    const [showMealModal, setShowMealModal] = useState(false);
    const [currentDayKey, setCurrentDayKey] = useState(null);
    const [currentMeal, setCurrentMeal] = useState(null);
    const [menuData, setMenuData] = useState({});
    const [newItemInputs, setNewItemInputs] = useState({});

    useEffect(() => {
        const fetchMenu = async () => {
            const newMenuData = {};
            for (let meal of mealOptions) {
                const docRef = doc(db, "menu", meal);
                const snap = await getDoc(docRef);
                if (!snap.exists()) continue;

                const data = snap.data();
                const categories = {};

                Object.entries(data.categories || {}).forEach(([catName, catObj]) => {
                    const catItems = {};
                    Object.entries(catObj || {}).forEach(([catItemName, catItemObj]) => {
                        if (catItemName === "price") return;
                        catItems[catItemName] = (catItemObj.menuItems || []).map(i => i.name);
                    });
                    categories[catName] = catItems;
                });

                newMenuData[meal] = { categories };
            }
            setMenuData(newMenuData);
        };
        fetchMenu();
    }, []);

    useEffect(() => {
        if (meals && meals["No. of days"]) setNumDays(parseInt(meals["No. of days"]) || 1);
    }, [meals]);

    const toggleMeal = (dayKey, meal) => {
        setMeals(prev => {
            const updated = { ...prev };
            const dayMeals = { ...(updated[dayKey] || {}) };
            if (dayMeals[meal]) delete dayMeals[meal];
            else {
                const defaultOption = Object.keys(menuData[meal]?.categories || {})[0] || "";
                const items = Object.values(menuData[meal]?.categories?.[defaultOption] || {})
                    .flatMap(subCat => (subCat.menuItems || []).filter(i => i.visibility).map(i => i.name)) || [];
                dayMeals[meal] = {
                    pax: "",
                    rate: "",
                    startTime: "",
                    endTime: "",
                    total: 0,
                    option: defaultOption,
                    items,
                    selectedItems: items,
                    newItem: ""
                };
            }
            updated[dayKey] = dayMeals;
            return updated;
        });
    };

    const handleChange = (dayKey, meal, field, value) => {
        setMeals(prev => {
            const updated = { ...prev };
            const dayMeals = updated[dayKey] || {};
            const item = dayMeals[meal] || {};
            const newItem = { ...item, [field]: value };
            if (field === "rate" || field === "pax") {
                const rate = parseFloat(newItem.rate) || 0;
                const pax = parseFloat(newItem.pax) || 0;
                newItem.total = rate * pax;
            }
            dayMeals[meal] = newItem;
            updated[dayKey] = dayMeals;
            return updated;
        });
    };

    useImperativeHandle(ref, () => ({
        validateMeals: () => {
            let isValid = true;
            for (const dayKey in meals) {
                const dayMeals = meals[dayKey];
                if (!dayMeals) continue;
                for (const meal in dayMeals) {
                    const { rate, pax, startTime, endTime } = dayMeals[meal];
                    if (!rate || !pax || !startTime || !endTime) isValid = false;
                }
            }
            return isValid;
        }
    }));

    const getMealOptionsForMeal = (meal, dayDate, functionDate, dayNight) => {
        if (!menuData[meal]) return [];
        if (meal === "Dinner" && dayDate === functionDate && dayNight === "Night") return [];
        if (meal === "Lunch" && dayDate === functionDate && dayNight === "Day") return [];
        return Object.keys(menuData[meal]?.categories || {});
    };

    return (
        <div className="meal-selection">
            <h4>4. Meal Selection</h4>
            <div className="num-days" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>No. of Days: </label>
                <input
                    style={{ width: '40vw' }}
                    type="text"
                    inputMode="numeric"
                    value={numDays}
                    onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setNumDays(val);
                        const numVal = parseInt(val);
                        if (!isNaN(numVal)) {
                            setMeals(prev => {
                                const updated = { ...prev, "No. of days": numVal.toString() };
                                for (let i = 1; i <= numVal; i++) {
                                    const dayKey = `Day${i}`;
                                    if (!updated[dayKey]) updated[dayKey] = {};
                                }
                                return updated;
                            });
                        }
                    }}
                />
            </div>

            {Array.from({ length: numDays }, (_, dIndex) => {
                const dayKey = `Day${dIndex + 1}`;
                const dayMeals = meals[dayKey] || {};
                return (
                    <div key={dayKey} className="day-section">
                        <h5 style={{ display: 'flex', justifyContent: 'space-between' }}>
                            Day {dIndex + 1} Date:
                            <input
                                style={{ width: '40vw' }}
                                type="date"
                                value={dayMeals.date || ""}
                                onChange={(e) =>
                                    setMeals(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], date: e.target.value } }))
                                }
                            />
                        </h5>

                        {mealOptions.map(meal => {
                            const availableOptions = getMealOptionsForMeal(meal, dayMeals.date, functionDate, dayNight);
                            if (availableOptions.length === 0) return null;
                            const selected = !!dayMeals[meal];
                            const data = dayMeals[meal] || {};

                            return (
                                <div key={meal} className="meal-card">
                                    <div className="meal-left">
                                        <input type="checkbox" checked={selected} onChange={() => toggleMeal(dayKey, meal)} />
                                        <span className="meal-label">{meal}</span>
                                    </div>

                                    {selected && (
                                        <div className="meal-inputs-wrapper">
                                            <div className="meal-option-dropdown">

                                                <div className="num-days" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center' }}>Options: </label>
                                                    <select
                                                        style={{ width: '40vw' }}
                                                        value={data.option || availableOptions[0]}
                                                        onChange={e => {
                                                            const newOption = e.target.value;
                                                            handleChange(dayKey, meal, "option", newOption);
                                                            setMeals(prev => {
                                                                const updated = { ...prev };
                                                                const items = Object.values(menuData[meal]?.categories?.[newOption] || {}).flat();
                                                                updated[dayKey][meal] = { ...updated[dayKey][meal], items, selectedItems: items, newItem: "" };
                                                                return updated;
                                                            });
                                                        }}
                                                    >
                                                        {availableOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </div>

                                                <div className="num-days" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center' }}>Menu Items: </label>

                                                    <button style={{
                                                        marginTop: '10',
                                                        padding: "6px 12px",
                                                        backgroundColor: "#eea220ff",
                                                        color: "white",
                                                        border: "none",
                                                        borderRadius: 4,
                                                        cursor: "pointer"
                                                    }}
                                                        type="button"
                                                        onClick={() => { setCurrentDayKey(dayKey); setCurrentMeal(meal); setShowMealModal(true); }}
                                                    >🍽 Menu</button>
                                                </div>

                                                <div className="meal-inputs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center' }}>Rate:</label>
                                                    <input style={{ width: '40vw' }} type="text" placeholder="" value={data.rate || ""} onChange={e => handleChange(dayKey, meal, "rate", e.target.value.replace(/[^0-9.]/g, ""))} />
                                                </div>

                                                <div className="meal-inputs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center' }}>Qty:</label>
                                                    <input style={{ width: '40vw' }} type="text" placeholder="" value={data.pax || ""} onChange={e => handleChange(dayKey, meal, "pax", e.target.value.replace(/[^0-9]/g, ""))} />
                                                </div>
                                                <div className="meal-inputs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center' }}></label>
                                                    <span>Total: ₹{data.total?.toFixed(0) || 0}</span>
                                                </div>

                                                <div className="meal-inputs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center' }}>Start Time:</label>
                                                    <input style={{ width: '40vw' }} type="time" value={data.startTime || ""} onChange={e => handleChange(dayKey, meal, "startTime", e.target.value)} />
                                                </div>

                                                <div className="meal-inputs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center' }}>End Time:</label>
                                                    <input style={{ width: '40vw' }} type="time" value={data.endTime || ""} onChange={e => handleChange(dayKey, meal, "endTime", e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>
                );
            })}

            {showMealModal && currentDayKey && currentMeal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                        <h3>Select {currentMeal} Items</h3>

                        {Object.entries(
                            menuData[currentMeal]?.categories?.[meals[currentDayKey][currentMeal]?.option] || {}
                        ).map(([subCatName, items]) => {
                            const newItemKey = `${currentMeal}_${subCatName}`;
                            return (
                                <div key={subCatName} style={{ marginBottom: 12 }}>
                                    <h4 style={{ fontWeight: 600 }}>{subCatName.toUpperCase()}</h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {items.map(item => {
                                            const isChecked = meals[currentDayKey][currentMeal]?.selectedItems?.includes(item);
                                            return (
                                                <label key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>

                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            setMeals(prev => {
                                                                const updated = { ...prev };
                                                                const mealObj = updated[currentDayKey][currentMeal];
                                                                const selectedItems = isChecked
                                                                    ? mealObj.selectedItems.filter(i => i !== item)
                                                                    : [...mealObj.selectedItems, item];
                                                                updated[currentDayKey][currentMeal] = { ...mealObj, selectedItems };
                                                                return updated;
                                                            });
                                                        }}
                                                    />
                                                    {item}
                                                </label>
                                            );
                                        })}

                                        {/* Add new item input */}
                                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                            <input
                                                type="text"
                                                placeholder=""
                                                value={newItemInputs[newItemKey] || ""}
                                                onChange={e => setNewItemInputs(prev => ({ ...prev, [newItemKey]: e.target.value }))}
                                                style={{ flex: 1, padding: "4px 8px" }}
                                            />
                                            <button
                                                type="button"
                                                style={{
                                                    padding: "6px 12px",
                                                    backgroundColor: "#4dd219ff",
                                                    color: "white",
                                                    border: "none",
                                                    borderRadius: 4,
                                                    cursor: "pointer"
                                                }}
                                                onClick={() => {
                                                    const itemValue = newItemInputs[newItemKey]?.trim();
                                                    if (!itemValue) return;

                                                    setMenuData(prev => {
                                                        const updated = { ...prev };
                                                        const cat = meals[currentDayKey][currentMeal].option;
                                                        if (!updated[currentMeal].categories[cat][subCatName]) {
                                                            updated[currentMeal].categories[cat][subCatName] = [];
                                                        }
                                                        // ✅ Only add if it doesn't exist already
                                                        if (!updated[currentMeal].categories[cat][subCatName].includes(itemValue)) {
                                                            updated[currentMeal].categories[cat][subCatName].push(itemValue);
                                                        }
                                                        return updated;
                                                    });

                                                    setMeals(prev => {
                                                        const updated = { ...prev };
                                                        const mealObj = updated[currentDayKey][currentMeal];
                                                        // ✅ Keep previous selections, only add new one
                                                        if (!mealObj.selectedItems.includes(itemValue)) {
                                                            mealObj.selectedItems = [...mealObj.selectedItems, itemValue];
                                                        }
                                                        updated[currentDayKey][currentMeal] = mealObj;
                                                        return updated;
                                                    });

                                                    setNewItemInputs(prev => ({ ...prev, [newItemKey]: "" }));
                                                }}
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <button
                            onClick={() => setShowMealModal(false)}
                            style={{
                                marginTop: 10,
                                padding: "6px 12px",
                                backgroundColor: "#ed4e2eff",
                                color: "white",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer"
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
});

export default MealSelection;
