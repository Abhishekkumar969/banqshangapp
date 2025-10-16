import React, { useState } from 'react';
import '../styles/BookingAmenities.css'; // Make sure to update styles accordingly

const predefinedTypes = [
    "Wedding", "Reception", "Engagement", "Birthday", "Anniversary",
    "Tilak", "Corporate Party", "Haldi & Mehndi"
];

const FunctionTypeSelector = ({ selectedType, setForm }) => {
    const [customType, setCustomType] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [types, setTypes] = useState(predefinedTypes);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleSelect = (type) => {
        setForm(prev => ({ ...prev, functionType: type }));
        setDrawerOpen(false);
    };

    const handleAddCustomType = () => {
        const trimmed = customType.trim();
        if (trimmed && !types.includes(trimmed)) {
            setTypes([...types, trimmed]);
        }
        setForm(prev => ({ ...prev, functionType: trimmed }));
        setCustomType('');
        setDrawerOpen(false);
    };

    const filteredSuggestions = suggestions.filter(
        sug => sug.toLowerCase().includes(customType.toLowerCase()) &&
            sug.toLowerCase() !== customType.toLowerCase()
    );

    return (
        <div className="function-type-container">
            <button type="button" onClick={() => setDrawerOpen(true)} className="drawer-trigger">
                {selectedType ? `🎉 ${selectedType}` : 'Select Function Type'}
            </button>

            {drawerOpen && (
                <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
                    <div className="drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-header">
                            <h3>Select Function Type</h3>
                            <button onClick={() => setDrawerOpen(false)}>✕</button>
                        </div>

                        <ul className="drawer-list">
                            {types.map((type, index) => (
                                <li key={index}>
                                    <label>
                                        <input
                                            type="radio"
                                            name="functionType"
                                            checked={selectedType === type}
                                            onChange={() => handleSelect(type)}
                                        />
                                        {type}
                                    </label>
                                </li>
                            ))}
                        </ul>

                        <div className="drawer-custom">
                            <input
                                type="text"
                                value={customType}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomType(val);
                                    setSuggestions(types.filter(t =>
                                        t.toLowerCase().includes(val.toLowerCase())
                                    ));
                                }}
                                placeholder=""
                            />
                            <button onClick={handleAddCustomType}>Add</button>
                            {customType && filteredSuggestions.length > 0 && (
                                <ul className="suggestion-box">
                                    {filteredSuggestions.map((sug, index) => (
                                        <li key={index} onClick={() => setCustomType(sug)}>
                                            {sug}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FunctionTypeSelector;
