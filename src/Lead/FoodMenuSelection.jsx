import React, { useEffect, useState } from 'react';
import '../styles/BookingAmenities.css';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const FoodMenuSelection = ({ selectedMenus, setSelectedMenus, noOfPlates }) => {
    const [menuItems, setMenuItems] = useState({});

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const docRef = doc(db, "menu", "Dinner");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const categories = data.categories || {};

                    // 🔹 Extract { name: price } format
                    const items = {};
                    Object.entries(categories).forEach(([key, value]) => {
                        items[key] = Number(value.price) || 0;
                    });

                    setMenuItems(items);
                }
            } catch (err) {
                console.error("Error fetching menu:", err);
            }
        };

        fetchMenu();
    }, []);

    const handleChange = (item, field, value) => {
        setSelectedMenus((prev) => {
            const updated = { ...prev };
            if (!updated[item]) {
                updated[item] = { rate: menuItems[item], qty: '', total: 0 };
            }

            updated[item][field] = value;

            const rate = parseFloat(updated[item].rate || 0);
            const qty = parseInt(updated[item].qty || 0);
            updated[item].total = rate * qty || 0;

            return updated;
        });
    };

    const toggleSelection = (item) => {
        setSelectedMenus((prev) => {
            const updated = { ...prev };

            if (updated[item]) {
                delete updated[item];
            } else {
                updated[item] = {
                    rate: menuItems[item],
                    qty: noOfPlates || '',
                    total: (menuItems[item] * (noOfPlates || 0)) || 0
                };
            }
            return updated;
        });
    };

    return (
        <div className="food-menu-selection">
            <h4>2. Food Menu Selection</h4>

            {Object.keys(menuItems).length === 0 ? (
                <p>Loading menu...</p>
            ) : (
                Object.keys(menuItems)
                    .sort((a, b) => a.localeCompare(b))
                    .map((item, index) => {
                        const isSelected = selectedMenus[item];
                        return (
                            <div key={index} className="menu-row">
                                <input
                                    type="checkbox"
                                    checked={!!isSelected}
                                    onChange={() => toggleSelection(item)}
                                />
                                <span className="menu-label" style={{ fontWeight: 'bold', fontSize: '17px', marginLeft: '10px' }}>
                                    {item.replace(/\b\w/g, char => char.toUpperCase())}
                                </span>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                    <span className="math-symbol" style={{ display: 'flex', alignItems: 'center' }}> Rate: </span>
                                    <input
                                        style={{ width: '40vw', marginTop: '10px' }}
                                        type="text"
                                        inputMode="decimal"
                                        placeholder=""
                                        disabled={!isSelected}
                                        value={selectedMenus[item]?.rate || menuItems[item] || ''}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/[^0-9.]/g, "");
                                            if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                            handleChange(item, "rate", val);
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className="math-symbol" style={{ display: 'flex', alignItems: 'center' }}> Pax: </span>
                                    <input
                                        style={{ width: '40vw', marginTop: '10px' }}
                                        type="text"
                                        inputMode="numeric"
                                        placeholder=""
                                        disabled={!isSelected}
                                        value={selectedMenus[item]?.qty || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            handleChange(item, "qty", val);
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                    <label style={{ display: "flex", alignItems: 'center' }}></label>
                                    <span>Total: ₹{selectedMenus[item]?.total?.toFixed(0) || '0'}</span>
                                </div>

                            </div>
                        );
                    })
            )}
        </div>
    );
};

export default FoodMenuSelection;
