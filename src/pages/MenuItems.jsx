import React, { useEffect, useState, useCallback } from "react";
import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const styles = {
    container: {
        padding: "30px",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        background: "transparent",
        borderRadius: "12px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        minHeight: "100vh",
        backgroundImage: "url('https://www.transparenttextures.com/patterns/food.png')",
        backgroundRepeat: "repeat",
        backgroundSize: "contain",
    },
    heading: {
        marginBottom: "20px",
        fontSize: "1.6rem",
        color: "#d35400",
        fontWeight: "600",
    },
    form: {
        marginBottom: "20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        alignItems: "center",
    },
    select: {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        fontSize: "0.95rem",
        outline: "none",
        flex: "1 1 120px",
        minWidth: "120px",
    },
    input: {
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        fontSize: "0.95rem",
        outline: "none",
        minWidth: "120px",
    },
    button: {
        padding: "8px 16px",
        cursor: "pointer",
        borderRadius: "8px",
        border: "none",
        background: "#e67e22",
        color: "#fff",
        fontWeight: "500",
        flex: "0 0 auto",
    },
    cardContainer1: { display: "flex", justifyContent: "center" },
    cardContainer: { display: "grid", gap: "15px", width: "70vw" },
    card: {
        background: "#fff8f0",
        borderRadius: "12px",
        padding: "12px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        border: "1px solid black",
    },
    cardHeader: {
        fontWeight: "600",
        marginBottom: "6px",
        color: "#d35400",
        cursor: "pointer",
    },
    itemRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid #ffe6d6",
        flexWrap: "wrap",
    },
    noItems: { marginTop: "15px", fontStyle: "italic", color: "#a0522d" },
};

const MenuItems = () => {
    const [menuType, setMenuType] = useState("Breakfast");
    const [category, setCategory] = useState("");
    const [categoryPrice, setCategoryPrice] = useState("");
    const [groupedItems, setGroupedItems] = useState({});
    const [expandedCategories, setExpandedCategories] = useState({});
    const [expandedCategoryItems, setExpandedCategoryItems] = useState({});
    const [cardInputs, setCardInputs] = useState({});
    const [editingPrice, setEditingPrice] = useState({});
    const [priceInputs, setPriceInputs] = useState({});

    /* 🔹 Fetch items */
    const fetchItems = useCallback(async () => {
        const docRef = doc(db, "menu", menuType);
        const snap = await getDoc(docRef);
        let structured = {};

        if (snap.exists()) {
            const data = snap.data();
            if (data.categories) {
                Object.entries(data.categories).forEach(([cat, catObj]) => {
                    structured[cat] = { price: catObj.price || 0 };

                    Object.entries(catObj).forEach(([catItem, obj]) => {
                        if (catItem !== "price") {
                            structured[cat][catItem] = obj.menuItems || [];
                        }
                    });
                });
            }
        }
        setGroupedItems(structured);
    }, [menuType]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    /* 🔹 Add new category */
    const addCategory = async (e) => {
        e.preventDefault();
        if (!category || !categoryPrice) return alert("Enter category name and price");

        const docRef = doc(db, "menu", menuType);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};

        const updatedData = {
            categories: {
                ...(data.categories || {}),
                [category.toLowerCase()]: {
                    ...(data.categories?.[category.toLowerCase()] || {}),
                    price: Number(categoryPrice),
                },
            },
        };

        await setDoc(docRef, updatedData, { merge: true });
        setCategory("");
        setCategoryPrice("");
        fetchItems();
    };

    /* 🔹 Add category item */
    const addCategoryItem = async (cat, newCatItemName) => {
        if (!newCatItemName) return alert("Enter category item name");

        const docRef = doc(db, "menu", menuType);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};

        const updatedData = {
            categories: {
                ...(data.categories || {}),
                [cat.toLowerCase()]: {
                    ...(data.categories?.[cat.toLowerCase()] || {}),
                    [newCatItemName.toLowerCase()]: { menuItems: [] },
                    price: data.categories?.[cat.toLowerCase()]?.price || 0,
                },
            },
        };

        await setDoc(docRef, updatedData, { merge: true });
        fetchItems();
    };

    /* 🔹 Add item to category item */
    const addItem = async (cat, catItem, newItemName) => {
        if (!newItemName) return alert("Enter item name");

        const docRef = doc(db, "menu", menuType);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};

        const existingItems =
            data?.categories?.[cat.toLowerCase()]?.[catItem.toLowerCase()]?.menuItems || [];

        const newItem = {
            id: Date.now().toString(),
            name: newItemName,
            type: menuType,
            visibility: true,
        };

        const updatedData = {
            categories: {
                ...(data.categories || {}),
                [cat.toLowerCase()]: {
                    ...(data.categories?.[cat.toLowerCase()] || {}),
                    [catItem.toLowerCase()]: { menuItems: [...existingItems, newItem] },
                    price: data.categories?.[cat.toLowerCase()]?.price || 0,
                },
            },
        };

        await setDoc(docRef, updatedData, { merge: true });
        fetchItems();
    };

    /* 🔹 Toggle item visibility */
    const toggleVisibility = async (cat, catItem, id) => {
        const docRef = doc(db, "menu", menuType);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const existingItems =
            data.categories?.[cat.toLowerCase()]?.[catItem.toLowerCase()]?.menuItems || [];

        const updatedItems = existingItems.map((itm) =>
            itm.id === id ? { ...itm, visibility: !itm.visibility } : itm
        );

        const updatedData = {
            categories: {
                ...(data.categories || {}),
                [cat.toLowerCase()]: {
                    ...(data.categories?.[cat.toLowerCase()] || {}),
                    [catItem.toLowerCase()]: { menuItems: updatedItems },
                    price: data.categories?.[cat.toLowerCase()]?.price || 0,
                },
            },
        };

        await setDoc(docRef, updatedData, { merge: true });
        fetchItems();
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>🍽 Manage Menu Items</h2>

            {/* 🔹 Add category form */}
            <form onSubmit={addCategory} style={styles.form}>
                <select
                    value={menuType}
                    onChange={(e) => setMenuType(e.target.value)}
                    style={styles.select}
                >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Dinner">Dinner</option>
                </select>

                <input
                    type="text"
                    placeholder="Add Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={styles.input}
                />

                <input
                    type="text"
                    placeholder="Category Price"
                    value={categoryPrice || ""}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                            setCategoryPrice(val);
                        }
                    }}
                    style={{ ...styles.input, width: "180px" }}
                />


                <button type="submit" style={styles.button}>
                    Add
                </button>
            </form>

            {/* 🔹 Show Categories */}
            {Object.keys(groupedItems).length > 0 ? (
                <div style={styles.cardContainer1}>
                    <div style={styles.cardContainer}>
                        {Object.entries(groupedItems)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([cat, catObj]) => {
                                const isCatExpanded = expandedCategories[cat] || false;
                                const newCatItemName = cardInputs[`cat__${cat}`] || "";

                                return (
                                    <div
                                        key={`${menuType}_${cat}`} // ✅ stable key to prevent jumps
                                        style={{ ...styles.card, display: "flex", flexDirection: "column" }}
                                    >
                                        {/* 🔹 Category Header */}
                                        <div
                                            style={{
                                                ...styles.cardHeader,
                                                display: "flex",
                                                alignItems: "center",
                                                color: "#ff6a00ff",
                                                fontWeight: "1000",
                                                flexDirection: "column",
                                            }}
                                        >
                                            <div style={{ padding: "2px 10px", width: "100%" }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        padding: "5px 10px",
                                                        backgroundColor: "rgba(255, 118, 72, 0.19)",
                                                        borderRadius: "7px",
                                                        boxShadow: "2px 2px 2px #feb7a0ff ",
                                                        marginBottom: "10px",
                                                    }}
                                                    onClick={() =>
                                                        setExpandedCategories((prev) => ({
                                                            ...prev,
                                                            [cat]: !prev[cat],
                                                        }))
                                                    }
                                                >
                                                    {editingPrice[cat] ? (
                                                        <input
                                                            type="text"
                                                            value={priceInputs[`${cat}_name`] ?? cat}
                                                            onChange={(e) =>
                                                                setPriceInputs((prev) => ({
                                                                    ...prev,
                                                                    [`${cat}_name`]: e.target.value,
                                                                }))
                                                            }
                                                            style={{
                                                                flex: 1,
                                                                borderRadius: "6px",
                                                                border: "1px solid #ccc",
                                                                padding: "2px 10px",
                                                                marginRight: "10px",
                                                            }}
                                                        />
                                                    ) : (
                                                        <span>{cat.toUpperCase()}</span>
                                                    )}
                                                    <span>{isCatExpanded ? "▲" : "▼"}</span>
                                                </div>

                                                {/* 🔹 Price Section */}
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "flex-end",
                                                        padding: "2px 10px",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontWeight: "500",
                                                            color: "black",
                                                            marginRight: "10px",
                                                        }}
                                                    >
                                                        Price:
                                                    </span>
                                                    {editingPrice[cat] ? (
                                                        <>
                                                            <input
                                                                type="text"
                                                                value={priceInputs[cat] ?? catObj.price ?? ""}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (/^\d*$/.test(val)) {
                                                                        setPriceInputs((prev) => ({
                                                                            ...prev,
                                                                            [cat]: val,
                                                                        }));
                                                                    }
                                                                }}
                                                                style={{
                                                                    width: "80px",
                                                                    borderRadius: "6px",
                                                                    border: "1px solid #ccc",
                                                                    padding: "2px 10px",
                                                                }}
                                                            />
                                                            <button
                                                                onClick={async () => {
                                                                    const newName = priceInputs[`${cat}_name`] || cat;
                                                                    const newPrice = Number(priceInputs[cat] || 0);
                                                                    const docRef = doc(db, "menu", menuType);

                                                                    // ✅ 1. Agar name change hua to puri category rename karni hogi
                                                                    if (newName !== cat) {
                                                                        const menuSnap = await getDoc(docRef);
                                                                        if (menuSnap.exists()) {
                                                                            const data = menuSnap.data();
                                                                            const categories = data.categories || {};

                                                                            const updatedCategories = { ...categories };
                                                                            updatedCategories[newName.toLowerCase()] = {
                                                                                ...categories[cat.toLowerCase()],
                                                                                price: newPrice,
                                                                            };
                                                                            delete updatedCategories[cat.toLowerCase()];

                                                                            await updateDoc(docRef, { categories: updatedCategories });
                                                                        }
                                                                    } else {
                                                                        // ✅ 2. Sirf price update karna ho
                                                                        await updateDoc(docRef, {
                                                                            [`categories.${cat.toLowerCase()}.price`]: newPrice,
                                                                        });
                                                                    }

                                                                    setEditingPrice((prev) => ({
                                                                        ...prev,
                                                                        [cat]: false,
                                                                    }));
                                                                    fetchItems();
                                                                }}
                                                                style={{
                                                                    padding: "4px 8px",
                                                                    marginLeft: "10px",
                                                                    borderRadius: "6px",
                                                                    background: "#2ecc71",
                                                                    color: "#fff",
                                                                }}
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setEditingPrice((prev) => ({
                                                                        ...prev,
                                                                        [cat]: false,
                                                                    }))
                                                                }
                                                                style={{
                                                                    padding: "4px 8px",
                                                                    marginLeft: "5px",
                                                                    borderRadius: "6px",
                                                                    background: "#cc2e2e",
                                                                    color: "#fff",
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>{catObj.price || 0}</span>
                                                            <button
                                                                onClick={() =>
                                                                    setEditingPrice((prev) => ({
                                                                        ...prev,
                                                                        [cat]: true,
                                                                    }))
                                                                }
                                                                style={{
                                                                    padding: "2px 6px",
                                                                    marginLeft: "10px",
                                                                    borderRadius: "6px",
                                                                    background: "#f39c12",
                                                                    color: "#fff",
                                                                    fontSize: "0.8rem",
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 🔹 Expand Category */}
                                        {isCatExpanded && (
                                            <div
                                                style={{
                                                    paddingLeft: "12px",
                                                    marginTop: "8px",
                                                    borderTop: "1px solid red",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "8px",
                                                    overflow: "hidden",
                                                    transition: "all 0.25s ease",
                                                }}
                                            >
                                                {/* 🔹 Add new category item */}
                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    <input
                                                        type="text"
                                                        placeholder="New category item"
                                                        value={newCatItemName}
                                                        onChange={(e) =>
                                                            setCardInputs((prev) => ({
                                                                ...prev,
                                                                [`cat__${cat}`]: e.target.value,
                                                            }))
                                                        }
                                                        style={{ flex: 1, minWidth: "120px", ...styles.input }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (!newCatItemName?.trim()) return;
                                                            addCategoryItem(cat, newCatItemName);
                                                            setCardInputs((prev) => ({
                                                                ...prev,
                                                                [`cat__${cat}`]: "",
                                                            }));
                                                        }}
                                                        style={styles.button}
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                {/* 🔹 Show category items */}
                                                {Object.entries(catObj)
                                                    .filter(([key]) => key !== "price")
                                                    .map(([catItem, itemsList]) => {
                                                        const key = `${cat}__${catItem}`;
                                                        const isCatItemExpanded = expandedCategoryItems[key] || false;
                                                        const newItemName = cardInputs[key] || "";

                                                        // 🔹 Subcategory editing state
                                                        const isEditingSubcat = editingPrice[`subcat_${key}`] || false;
                                                        const subcatEditValue =
                                                            priceInputs[`subcat_${key}`] ?? catItem;

                                                        return (
                                                            <div
                                                                key={key}
                                                                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                                                            >
                                                                {/* 🔹 Subcategory Header */}
                                                                <div
                                                                    style={{ ...styles.cardHeader, cursor: "pointer" }}
                                                                    onClick={() =>
                                                                        setExpandedCategoryItems((prev) => ({
                                                                            ...prev,
                                                                            [key]: !prev[key],
                                                                        }))
                                                                    }

                                                                >

                                                                    {isEditingSubcat ? (
                                                                        <>
                                                                            <input
                                                                                type="text"
                                                                                value={subcatEditValue}
                                                                                onChange={(e) =>
                                                                                    setPriceInputs((prev) => ({
                                                                                        ...prev,
                                                                                        [`subcat_${key}`]: e.target.value,
                                                                                    }))
                                                                                }
                                                                                style={{
                                                                                    flex: 1,
                                                                                    borderRadius: "6px",
                                                                                    border: "1px solid #ccc",
                                                                                    padding: "2px 10px",
                                                                                }}
                                                                            />
                                                                            <button
                                                                                onClick={async () => {
                                                                                    const docRef = doc(db, "menu", menuType);
                                                                                    const snap = await getDoc(docRef);
                                                                                    if (!snap.exists()) return;

                                                                                    const data = snap.data();
                                                                                    const categories = data.categories || {};
                                                                                    const categoryObj = categories[cat.toLowerCase()] || {};

                                                                                    // 🔹 rename subcategory (keep items + price safe)
                                                                                    const updatedCategory = {
                                                                                        ...categoryObj,
                                                                                        [subcatEditValue.toLowerCase()]:
                                                                                            categoryObj[catItem.toLowerCase()],
                                                                                    };
                                                                                    delete updatedCategory[catItem.toLowerCase()];

                                                                                    await updateDoc(docRef, {
                                                                                        [`categories.${cat.toLowerCase()}`]: updatedCategory,
                                                                                    });

                                                                                    setEditingPrice((prev) => ({
                                                                                        ...prev,
                                                                                        [`subcat_${key}`]: false,
                                                                                    }));
                                                                                    fetchItems();
                                                                                }}
                                                                                style={{
                                                                                    padding: "2px 8px",
                                                                                    marginLeft: "6px",
                                                                                    borderRadius: "6px",
                                                                                    background: "#2ecc71",
                                                                                    color: "#fff",
                                                                                }}
                                                                            >
                                                                                Save
                                                                            </button>
                                                                            <button
                                                                                onClick={() =>
                                                                                    setEditingPrice((prev) => ({
                                                                                        ...prev,
                                                                                        [`subcat_${key}`]: false,
                                                                                    }))
                                                                                }
                                                                                style={{
                                                                                    padding: "2px 8px",
                                                                                    marginLeft: "5px",
                                                                                    borderRadius: "6px",
                                                                                    background: "#cc2e2e",
                                                                                    color: "#fff",
                                                                                }}
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </>

                                                                    ) : (
                                                                        <>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                <span>{catItem.toUpperCase()}</span>
                                                                                <div>
                                                                                    <span>{isCatItemExpanded ? "▲" : "▼"}</span>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setEditingPrice((prev) => ({
                                                                                                ...prev,
                                                                                                [`subcat_${key}`]: true,
                                                                                            }));
                                                                                        }}
                                                                                        style={{
                                                                                            padding: "2px 6px",
                                                                                            marginLeft: "10px",
                                                                                            borderRadius: "6px",
                                                                                            background: "#f39c12",
                                                                                            color: "#fff",
                                                                                            fontSize: "0.8rem",
                                                                                            cursor: "pointer",
                                                                                        }}
                                                                                    >
                                                                                        Edit
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* 🔹 Subcategory Items */}
                                                                {isCatItemExpanded && (
                                                                    <div
                                                                        style={{
                                                                            paddingLeft: "12px",
                                                                            display: "flex",
                                                                            flexDirection: "column",
                                                                            gap: "6px",
                                                                        }}
                                                                    >
                                                                        {itemsList.map((itm) => {
                                                                            const editKey = `${key}__${itm.id}`;
                                                                            const isEditing = editingPrice[editKey] || false;
                                                                            const editValue = priceInputs[editKey] ?? itm.name;

                                                                            return (
                                                                                <div key={itm.id} style={styles.itemRow}>
                                                                                    {isEditing ? (
                                                                                        <>
                                                                                            <input
                                                                                                type="text"
                                                                                                value={editValue}
                                                                                                onChange={(e) =>
                                                                                                    setPriceInputs((prev) => ({
                                                                                                        ...prev,
                                                                                                        [editKey]: e.target.value,
                                                                                                    }))
                                                                                                }
                                                                                                style={{
                                                                                                    flex: 1,
                                                                                                    padding: "4px 8px",
                                                                                                    borderRadius: "6px",
                                                                                                    border: "1px solid #ccc",
                                                                                                }}
                                                                                            />
                                                                                            <button
                                                                                                onClick={async () => {
                                                                                                    const docRef = doc(db, "menu", menuType);
                                                                                                    const snap = await getDoc(docRef);
                                                                                                    if (!snap.exists()) return;

                                                                                                    const data = snap.data();
                                                                                                    const existingItems =
                                                                                                        data.categories?.[cat.toLowerCase()]?.[
                                                                                                            catItem.toLowerCase()
                                                                                                        ]?.menuItems || [];

                                                                                                    const updatedItems = existingItems.map((x) =>
                                                                                                        x.id === itm.id
                                                                                                            ? { ...x, name: editValue }
                                                                                                            : x
                                                                                                    );

                                                                                                    await updateDoc(docRef, {
                                                                                                        [`categories.${cat.toLowerCase()}.${catItem.toLowerCase()}.menuItems`]:
                                                                                                            updatedItems,
                                                                                                    });

                                                                                                    setEditingPrice((prev) => ({
                                                                                                        ...prev,
                                                                                                        [editKey]: false,
                                                                                                    }));
                                                                                                    fetchItems();
                                                                                                }}
                                                                                                style={{
                                                                                                    padding: "4px 8px",
                                                                                                    marginLeft: "6px",
                                                                                                    borderRadius: "6px",
                                                                                                    background: "#2ecc71",
                                                                                                    color: "#fff",
                                                                                                }}
                                                                                            >
                                                                                                Save
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() =>
                                                                                                    setEditingPrice((prev) => ({
                                                                                                        ...prev,
                                                                                                        [editKey]: false,
                                                                                                    }))
                                                                                                }
                                                                                                style={{
                                                                                                    padding: "4px 8px",
                                                                                                    marginLeft: "5px",
                                                                                                    borderRadius: "6px",
                                                                                                    background: "#cc2e2e",
                                                                                                    color: "#fff",
                                                                                                }}
                                                                                            >
                                                                                                Cancel
                                                                                            </button>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <span>{itm.name.toUpperCase()}</span>
                                                                                            <div style={{ display: "flex", gap: "6px" }}>
                                                                                                <button
                                                                                                    onClick={() =>
                                                                                                        setEditingPrice((prev) => ({
                                                                                                            ...prev,
                                                                                                            [editKey]: true,
                                                                                                        }))
                                                                                                    }
                                                                                                    style={{
                                                                                                        padding: "2px 6px",
                                                                                                        marginLeft: "10px",
                                                                                                        borderRadius: "6px",
                                                                                                        background: "#f39c12",
                                                                                                        color: "#fff",
                                                                                                        fontSize: "0.8rem",
                                                                                                        cursor: "pointer",
                                                                                                    }}
                                                                                                >
                                                                                                    Edit
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() =>
                                                                                                        toggleVisibility(cat, catItem, itm.id)
                                                                                                    }
                                                                                                    style={{
                                                                                                        padding: "4px 8px",
                                                                                                        borderRadius: "6px",
                                                                                                        background: itm.visibility
                                                                                                            ? "#2ecc71"
                                                                                                            : "#e74c3c",
                                                                                                        color: "#fff",
                                                                                                        cursor: "pointer",
                                                                                                    }}
                                                                                                >
                                                                                                    {itm.visibility ? "Disable" : "Enable"}
                                                                                                </button>
                                                                                            </div>
                                                                                        </>
                                                                                    )}
                                                                                </div>

                                                                            );
                                                                        })}

                                                                        {/* 🔹 Add new item */}
                                                                        <div style={{ display: "flex", gap: "6px" }}>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="New item"
                                                                                value={newItemName}
                                                                                onChange={(e) =>
                                                                                    setCardInputs((prev) => ({
                                                                                        ...prev,
                                                                                        [key]: e.target.value,
                                                                                    }))
                                                                                }
                                                                                style={{ flex: 1, ...styles.input }}
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    addItem(cat, catItem, cardInputs[key]);
                                                                                    setCardInputs((prev) => ({ ...prev, [key]: "" }));
                                                                                }}
                                                                                style={styles.button}
                                                                            >
                                                                                Add
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                }
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ) : (
                <p style={styles.noItems}>No items found for {menuType}</p>
            )}

        </div>
    );
};

export default MenuItems;
