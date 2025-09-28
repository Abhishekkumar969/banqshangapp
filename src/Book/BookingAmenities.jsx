import React, { useState, useEffect } from 'react';
import '../styles/BookingAmenities.css';

const defaultAmenities = [
    "Welcome flex",
    "DJ with Floor",
    "Flower Decoration (Artificial)",
    "Temporary Electricity Challan",
    "Generator Power Backup",
    "Security Guards",
];

const toAddAmenities = [
    "6 Nos. Luxury Rooms",
    "9 Nos. Luxury Rooms"
];

const BookingAmenities = ({ selectedItems, setSelectedItems }) => {
    const [amenities, setAmenities] = useState(defaultAmenities);
    
    const [customItem, setCustomItem] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    // Merge previously selected custom items into amenities list
    useEffect(() => {
        const merged = [...new Set([...defaultAmenities, ...toAddAmenities,...selectedItems])];
        setAmenities(merged);
    }, [selectedItems]);

    // Pre-fill selection only if nothing is selected
    useEffect(() => {
        if (selectedItems.length === 0) {
            setSelectedItems(defaultAmenities);
        }
    }, [selectedItems.length, setSelectedItems]);


    // Load previous suggestions
    useEffect(() => {
        const storedSuggestions = JSON.parse(localStorage.getItem("customAmenitySuggestions") || "[]");
        setSuggestions(storedSuggestions);
    }, []);

    const handleCheckboxChange = (item) => {
        setSelectedItems((prev) =>
            prev.includes(item)
                ? prev.filter((i) => i !== item)
                : [...prev, item]
        );
    };

    const handleAddCustomItem = () => {
        const trimmedItem = customItem.trim();
        if (trimmedItem && !amenities.includes(trimmedItem)) {
            const updatedAmenities = [...amenities, trimmedItem];
            setAmenities(updatedAmenities);
            setSelectedItems((prev) => [...prev, trimmedItem]);

            // Save as suggestion
            const updatedSuggestions = [...suggestions, trimmedItem];
            setSuggestions(updatedSuggestions);
            localStorage.setItem("customAmenitySuggestions", JSON.stringify(updatedSuggestions));
        }
        setCustomItem('');
    };

    const filteredSuggestions = suggestions.filter(
        (sug) =>
            sug.toLowerCase().includes(customItem.toLowerCase()) &&
            sug.toLowerCase() !== customItem.toLowerCase()
    );

    const handleSuggestionClick = (sug) => {
        setCustomItem(sug);
    };

    return (
        <div className="booking-amenities">
            <h4 style={{ marginTop: '40px' }}>
                Complimentary Booking Amenities
            </h4>
            <ul className="amenities-list">
                {amenities.map((item, index) => (
                    <li key={index}>
                        <input
                            type="checkbox"
                            className="amenity-checkbox"
                            checked={selectedItems.includes(item)}
                            onChange={() => handleCheckboxChange(item)}
                        />
                        {item}
                    </li>
                ))}
            </ul>

            <div className="custom-amenity-form">
                <input
                    type="text"
                    value={customItem}
                    onChange={(e) => setCustomItem(e.target.value)}
                    placeholder=""
                />
                <button type="button" onClick={handleAddCustomItem}>Add</button>

                {customItem && filteredSuggestions.length > 0 && (
                    <ul className="suggestion-box">
                        {filteredSuggestions.map((sug, index) => (
                            <li key={index} onClick={() => handleSuggestionClick(sug)}>
                                {sug}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default BookingAmenities;
