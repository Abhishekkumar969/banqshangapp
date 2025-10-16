import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import debounce from 'lodash.debounce';
import '../styles/CustomChargeItems.css';

// ✅ Predefined items with stable IDs
const predefinedItems = [
    { id: 1, name: 'Natural Flower Decorations', qty: '1', rate: '', selected: false },
    { id: 2, name: 'Sahnai', qty: '1', rate: '', selected: false },
    { id: 3, name: 'PAAN Stall', qty: '1', rate: '', selected: false },
    {
        id: 4,
        name: 'Jaimala Package (2pcs jaimala Roses, 30 Baratimala, 2pcs Samdhimala, 1 chadar, 1pcs )',
        qty: '1',
        rate: '',
        selected: false
    },
    { id: 5, name: 'Additional Rooms ', qty: '', rate: '4000', selected: false },
];

const blankIfZero = v => (v === 0 ? '' : v);

const mergeWithPredefined = (selected = []) => {
    const merged = [...predefinedItems];
    selected.forEach(sel => {
        const idx = merged.findIndex(p => p.id === sel.id);
        const cleaned = {
            ...sel,
            qty: blankIfZero(sel.qty),
            rate: blankIfZero(sel.rate),
        };
        if (idx !== -1) merged[idx] = { ...merged[idx], ...cleaned };
        else merged.push(cleaned);
    });
    return merged;
};

const CustomChargeItems = forwardRef(({ customItems, setCustomItems }, ref) => {
    const [localItems, setLocalItems] = useState(mergeWithPredefined(customItems));
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (customItems) {
            setLocalItems(mergeWithPredefined(customItems));
        }
    }, [customItems]);

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
                .map(i => {
                    const qty = numOrBlank(i.qty);
                    const rate = numOrBlank(i.rate);
                    return {
                        ...i,
                        qty,
                        rate,
                        total: qty === '' || rate === '' ? 0 : qty * rate
                    };
                });
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
        updateRow(idx, () => ({
            [field]: value // keep as string, convert later
        }));

    const addNewItem = () => {
        setLocalItems(prev => {
            const next = [
                ...prev,
                { id: Date.now(), name: '', qty: '', rate: '', selected: true }
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
                        <label
                            style={{
                                display: "inline-block",
                                position: "relative",
                                cursor: "pointer",
                                marginRight: "12px",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => toggleSelection(idx)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span
                                style={{
                                    position: "relative",
                                    display: "inline-block",
                                    width: "14px",
                                    height: "14px",
                                    backgroundColor: item.selected ? "#4af650ff" : "#fff",
                                    border: "0.5px solid gray",
                                    borderRadius: "6px",
                                    boxShadow: item.selected
                                        ? "0 4px #9b9b9bff, 0 6px 8px rgba(27, 116, 7, 1)"
                                        : "0 4px #adadadff, 0 6px 5px rgba(0, 0, 0, 0)",
                                    transition: "all 0.1s ease-in-out",
                                }}
                            />
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
