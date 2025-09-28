import React, { useState, useEffect } from 'react';
import '../styles/BookingAmenities.css';

const predefinedTypes = [
  "Wedding", "Reception", "Engagement", "Birthday", "Anniversary",
  "Tilak", "Corporate Party", "Haldi & Mehndi"
];

const FunctionTypeSelector = ({ selectedType, onSelect }) => {
  const [customType, setCustomType] = useState('');
  const [types, setTypes] = useState(predefinedTypes);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);

  // Initialize on edit
  useEffect(() => {
    if (selectedType) {
      if (!types.includes(selectedType)) {
        setTypes(prev => [...prev, selectedType]);
      }
      setCustomType(selectedType);
    }
  }, [selectedType, types]);


  useEffect(() => {
    // filter suggestions whenever customType changes
    if (customType.trim() === '') {
      setFilteredSuggestions([]);
    } else {
      const filtered = types.filter(
        t => t.toLowerCase().includes(customType.toLowerCase()) && t !== customType
      );
      setFilteredSuggestions(filtered);
    }
  }, [customType, types]);

  const handleSelect = (type) => {
    onSelect(type);   // update parent
    setDrawerOpen(false);
    setCustomType(type); // keep selected type visible
  };

  const handleAddCustomType = () => {
    const trimmed = customType.trim();
    if (!trimmed) return;
    if (!types.includes(trimmed)) setTypes([...types, trimmed]);
    onSelect(trimmed);
    setCustomType(trimmed);
    setDrawerOpen(false);
  };

  return (
    <div className="function-type-container">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="drawer-trigger"
      >
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
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Add Custom Function"
              />
              <button onClick={handleAddCustomType}>Add</button>

              {filteredSuggestions.length > 0 && (
                <ul className="suggestion-box">
                  {filteredSuggestions.map((sug, index) => (
                    <li key={index} onClick={() => handleSelect(sug)}>
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
