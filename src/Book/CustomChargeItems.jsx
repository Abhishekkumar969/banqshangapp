import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import debounce from 'lodash.debounce';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import '../styles/CustomChargeItems.css';

const blankIfZero = v => (v === 0 ? '' : v);

const mergeWithDbItems = (dbItems = [], selected = []) => {
    const merged = dbItems.map(item => ({
        ...item,
        qty: blankIfZero(item.qty),
        rate: blankIfZero(item.rate),
        selected: false
    }));

    selected.forEach(sel => {
        const idx = merged.findIndex(p => p.id === sel.id);
        const cleaned = {
            ...sel,
            qty: blankIfZero(sel.qty),
            rate: blankIfZero(sel.rate),
            selected: true
        };
        if (idx !== -1) merged[idx] = { ...merged[idx], ...cleaned };
        else merged.push(cleaned);
    });

    return merged;
};




const CustomChargeItems = forwardRef(({ customItems, setCustomItems }, ref) => {
    const [dbItems, setDbItems] = useState([]);
    const [localItems, setLocalItems] = useState([]);
    const [errors, setErrors] = useState({});

    // Fetch user's Add-Ons from Firestore
    useEffect(() => {
        const fetchAddons = async () => {
            try {
                const auth = getAuth();
                const user = auth.currentUser;
                if (!user) return;

                const userRef = doc(db, 'usersAccess', user.email);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) return;

                const data = userSnap.data();
                if (data.accessToApp !== 'A' || !Array.isArray(data.addons)) return;

                const items = data.addons.map((addon, idx) => ({
                    id: idx + 1,
                    name: addon || '',
                    qty: '',
                    rate: '',
                    selected: false
                }));

                setDbItems(items);
            } catch (err) {
                console.error('Error fetching addons:', err);
            }
        };
        fetchAddons();
    }, []);


    // Merge selected items whenever dbItems or customItems change
    useEffect(() => {
        if (dbItems.length) {
            setLocalItems(mergeWithDbItems(dbItems, customItems));
        }
    }, [dbItems, customItems]);

    const numOrBlank = v => (v === '' ? '' : Number(v));

    const validateItems = (items) => {
        const newErrors = {};
        items.forEach((item, idx) => {
            if (item.selected) {
                if (item.qty === '' || Number(item.qty) === 0) {
                    newErrors[idx] = { ...(newErrors[idx] || {}), qty: true };
                }
                if (item.rate === '' || Number(item.rate) === 0) {
                    newErrors[idx] = { ...(newErrors[idx] || {}), rate: true };
                }
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    useImperativeHandle(ref, () => ({
        validateCustomItems: () => validateItems(localItems)
    }));

    const debouncedSave = useMemo(() =>
        debounce(items => {
            validateItems(items);
            const selectedOnly = items
                .filter(i => i.selected)
                .map(i => ({
                    ...i,
                    qty: numOrBlank(i.qty),
                    rate: numOrBlank(i.rate),
                    total: i.qty === '' || i.rate === '' ? 0 : i.qty * i.rate
                }));
            setCustomItems(selectedOnly);
        }, 200), [setCustomItems]
    );

    const updateRow = (idx, mutator) => {
        setLocalItems(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...mutator(next[idx]) };
            debouncedSave(next);
            return next;
        });
    };

    const toggleSelection = idx =>
        updateRow(idx, row => ({ selected: !row.selected }));

    const handleChange = (idx, field, value) =>
        updateRow(idx, () => ({ [field]: value }));

    const addNewItem = () => {
        setLocalItems(prev => {
            const next = [
                ...prev,
                { id: Date.now().toString(), name: '', qty: '', rate: '', selected: true }
            ];
            debouncedSave(next);
            return next;
        });
    };

    return (
        <div className="custom-items-section">
            <h4>2. Extra items / Add-Ons Charges</h4>

            {localItems.map((item, idx) => (
                <div key={item.id} className="custom-item-card">
                    <div className="item-header-row">
                        <label style={{ display: "inline-block", cursor: "pointer", marginRight: "12px" }}>
                            <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => toggleSelection(idx)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                display: "inline-block",
                                width: "14px",
                                height: "14px",
                                backgroundColor: item.selected ? "#4af650ff" : "#fff",
                                border: "0.5px solid gray",
                                borderRadius: "6px"
                            }} />
                        </label>

                        <input
                            type="text"
                            placeholder=""
                            value={item.name}
                            onChange={e => handleChange(idx, 'name', e.target.value)}
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                            <span className="math-symbol"> Rate: </span>
                            <input
                                style={{ width: '40vw', marginTop: '10px' }}
                                type="text"
                                inputMode="decimal"
                                placeholder=""
                                value={item.rate}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9.]/g, "");
                                    if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                    handleChange(idx, "rate", val);
                                }}
                                className={errors[idx]?.rate ? "error-border" : ""}
                            />
                        </div>
                        {errors[idx]?.rate && <span className="error">Required</span>}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                            <span className="math-symbol"> Pax: </span>
                            <input
                                style={{ width: '40vw', marginTop: '10px' }}
                                type="text"
                                inputMode="numeric"
                                placeholder=""
                                value={item.qty}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, "");
                                    handleChange(idx, "qty", val);
                                }}
                                className={errors[idx]?.qty ? "error-border" : ""}
                            />
                        </div>
                        {errors[idx]?.qty && <span className="error">Required</span>}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                            <label></label>
                            <span>Total: ₹{item.qty !== '' && item.rate !== ''
                                ? `${(Number(item.qty) * Number(item.rate)).toFixed(0)}`
                                : '—'}</span>
                        </div>
                    </div>
                </div>
            ))}

            <button type="button" className="add-item-btn" onClick={addNewItem}>
                + Add Item
            </button>
        </div>
    );
});

export default CustomChargeItems;
