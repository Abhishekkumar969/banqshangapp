import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { getDoc, collection, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import styles from "../styles/vendorProfile.module.css";
import BackButton from "../components/BackButton";

import makeAnimated from "react-select/animated";
import CreatableSelect from "react-select/creatable";
import { useNavigate } from 'react-router-dom';
import BottomNavigationBar from "../components/BottomNavigationBar";

const AdminProfile = () => {
  const navigate = useNavigate();
  const [adminProfile, setAdminProfile] = useState(null);
  const [venueTypes, setVenueTypes] = useState([]);
  const [functionTypes, setFunctionTypes] = useState([]);
  const [venueMenuOpen, setVenueMenuOpen] = useState(false);
  const [functionMenuOpen, setFunctionMenuOpen] = useState(false);
  const [hasVenueChanges, setHasVenueChanges] = useState(false);
  const [hasFunctionChanges, setHasFunctionChanges] = useState(false);
  const defaultVenueOptions = ["Hall with Front Lawn", "Hall with Front & Back Lawn", "Pool Side"];
  const defaultFunctionOptions = ["Wedding", "Reception", "Engagement", "Haldi & Mehndi", "Birthday", "Corporate Party", "Anniversary", "Dandiya"];
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(true);
  const animatedComponents = makeAnimated();
  const [userAppType, setUserAppType] = useState(null);
  const [amenities, setAmenities] = useState([]);
  const [amenitiesMenuOpen, setAmenitiesMenuOpen] = useState(false);
  const [hasAmenitiesChanges, setHasAmenitiesChanges] = useState(false);
  const defaultAmenityOptions = [
    "Welcome flex",
    "DJ with Floor",
    "Flower Decoration (Artificial)",
    "Temporary Electricity Challan",
    "Generator Power Backup",
    "Security Guards",
    "6 Nos. Luxury Rooms",
    "9 Nos. Luxury Rooms"
  ];

  const [addons, setAddons] = useState([]);
  const [addonsMenuOpen, setAddonsMenuOpen] = useState(false);
  const [hasAddonsChanges, setHasAddonsChanges] = useState(false);
  const defaultAddonsOptions = [
    "Natural Flower Decorations",
    "Sahnai",
    "PAAN Stall",
    "Jaimala Package (2pcs jaimala Roses, 30 Baratimala, 2pcs Samdhimala, 1 chadar, 1pcs)",
    "Additional Rooms"
  ];

  const [menuItems, setMenuItems] = useState([]);
  const [menuItemsMenuOpen, setMenuItemsMenuOpen] = useState(false);
  const [hasMenuItemsChanges, setHasMenuItemsChanges] = useState(false);
  const defaultMenuItemOptions = [
    "Cowmin + Manchuriyan + Golgappa + Chat",
    "Salad Bar",
    "Soft Drinks / Mocktails"
  ];


  useEffect(() => {
    const fetchUserData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        try {
          const userRef = doc(db, 'usersAccess', user.email);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserAppType(data.accessToApp); // set the app type

          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 10000);
    const auth = getAuth();
    let hasFetched = false;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && user.email && !hasFetched) {
        hasFetched = true;

        try {
          const q = query(
            collection(db, "usersAccess"),
            where("email", "==", user.email),
            where("accessToApp", "in", ["A", "D"])
          );

          const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
              const docSnap = snapshot.docs[0];
              const data = docSnap.data();
              setAdminProfile({ id: docSnap.id, ...data });
              setFunctionTypes(data.functionTypes || []);
              setVenueTypes(data.venueTypes || []);
              setAmenities(data.amenities || []);
              setAddons(data.addons || []);
              setMenuItems(data.menuItems || []);

            } else {
              console.warn("❌ No Admin Profile record found for this user.");
            }
          });

          // Cleanup snapshot listener
          return () => unsubscribeSnapshot();

        } catch (error) {
          console.error("🔥 Error fetching Admin Profile:", error);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      clearTimeout(timer);
    };
  }, []);

  const handleUpdateField = async (field) => {
    if (!editValue.trim() || !adminProfile) return;
    try {
      const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
      await updateDoc(adminProfileRef, { [field]: editValue });
      setAdminProfile({ ...adminProfile, [field]: editValue });
      setEditField(null);
      setEditValue("");
    } catch (error) {
      console.error("Error updating field:", error);
    }
  };

  return (

    <>
      <div className={styles.container}>
        <div style={{ marginBottom: '30px' }}> <BackButton />  </div>

        {adminProfile ? (
          <>
            <h2 className={styles.heading}>
              Hi {adminProfile?.name ? adminProfile.name : adminProfile?.firmName ? adminProfile.firmName : "Decoration"} 👋
            </h2>

            <div className={styles.emailContainer}>
              {adminProfile?.email && (
                <p className={styles.emailLine}>
                  📧 <strong>Email:</strong> {adminProfile.email}
                </p>
              )}
            </div>

            <div
              style={{
                fontWeight: '300',
                padding: "0",
                borderRadius: "6px",
                fontSize: "0.85rem",
              }}
              className={styles.adminProfileInfo}>
              {["firmName", "address", "contactNo", "termsAndConditions"].map((field) => (
                <div key={field} className={styles.fieldRow}>
                  {editField === field ? (
                    <>
                      <div>
                        <div>
                          <strong style={{ whiteSpace: "nowrap", fontWeight: '700', fontSize: "1rem", }}>
                            {field === "contactNo"
                              ? "Phone Number"
                              : field === "firmName"
                                ? "Firm Name"
                                : field === "email"
                                  ? "Email"
                                  : field === "termsAndConditions"
                                    ? "Terms & Conditions"
                                    : field.charAt(0).toUpperCase() + field.slice(1)}
                            :
                          </strong>
                        </div>

                      </div>

                      <div className={styles.itemButtons}>
                        {field === "termsAndConditions" ? (
                          <textarea
                            rows={10}
                            style={{ width: '100%', marginTop: '10px', padding: '10px', borderRadius: '10px', border: '1px solid gray' }}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className={styles.editTextarea}
                            placeholder="Enter terms and conditions (one per line)..."
                          />
                        ) : (
                          <textarea
                            type="text"
                            rows={5}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className={styles.editInput}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }} >
                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: "10px" }}>
                          <button type="button"
                            onClick={() => handleUpdateField(field)}
                            className={styles.saveButton}
                          >
                            Save
                          </button>
                          <button type="button"
                            onClick={() => setEditField(null)}
                            className={styles.cancelButton}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ whiteSpace: "nowrap", fontWeight: '600', fontSize: "0.8rem", }}>
                              {field === "contactNo"
                                ? "Phone Number"
                                : field === "firmName"
                                  ? "Firm Name"
                                  : field === "email"
                                    ? "Email"
                                    : field === "termsAndConditions"
                                      ? "Terms & Conditions"
                                      : field.charAt(0).toUpperCase() + field.slice(1)}
                              :
                            </strong>
                          </div>

                          <div className={styles.itemButtons} style={{}}>
                            <button type="button"
                              onClick={() => {
                                setEditField(field);
                                setEditValue(adminProfile[field] || "");
                              }}
                              className={styles.editButton}
                            >
                              {`>`}
                            </button>
                          </div>
                        </div>

                        <div style={{ marginLeft: "10px" }}>
                          {field === "termsAndConditions" ? (
                            <div
                              style={{
                                color: "#666565",
                                whiteSpace: "pre-line",
                                fontWeight: "400",
                                fontSize: "0.9rem",
                              }}
                            >
                              {adminProfile[field] || "Not Filled"}
                            </div>
                          ) : (
                            <strong style={{ color: "#666565", textTransform: "capitalize" }}>
                              {adminProfile[field] || "Not Filled"}
                            </strong>
                          )}
                        </div>
                      </div>


                    </>
                  )}
                </div>
              ))}
            </div>

            {/* ---------- Venue Types ---------- */}
            <div className={styles.fieldRow} style={{
              marginBottom: "20px",
              paddingBottom: "15px",
              borderBottom: "1px dashed #cbd5e1",
              borderTop: "1px dashed #cbd5e1",
            }}>
              <label htmlFor="venueType" className={styles.subHeading}>
                Venue Types:
              </label>

              {/* Display saved venue types */}
              <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {adminProfile?.venueTypes?.map(ft => (
                  <span key={ft} style={{
                    padding: "4px 8px",
                    backgroundColor: "#e0f7fa",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}>
                    {ft}
                  </span>
                ))}
              </div>

              <CreatableSelect
                isMulti
                components={{
                  ...animatedComponents,
                  DropdownIndicator: (props) => (
                    <div
                      {...props.innerProps}
                      onClick={(e) => {
                        e.stopPropagation();
                        setVenueMenuOpen(prev => !prev);
                        setFunctionMenuOpen(false); // close function dropdown if open
                      }}
                      style={{ cursor: "pointer", paddingRight: "8px", display: "flex", alignItems: "center" }}
                    >
                      {venueMenuOpen ? "▲" : "▼"}
                    </div>
                  ),
                  ClearIndicator: () => null,
                }}
                options={[
                  ...defaultVenueOptions.map(ft => ({ value: ft, label: ft })),
                  ...venueTypes.filter(ft => !defaultVenueOptions.includes(ft)).map(ft => ({ value: ft, label: ft }))
                ]}
                className={styles.selectBox}
                placeholder="Select or add venue types..."

                onChange={(selected) => {
                  const selectedValues = selected ? selected.map(s => s.value) : [];
                  setVenueTypes(selectedValues); // ✅ sirf selected values
                  setHasVenueChanges(JSON.stringify(selectedValues) !== JSON.stringify(adminProfile?.venueTypes || []));
                }}
                onCreateOption={(inputValue) => {
                  const newType = inputValue.trim();
                  if (!newType || venueTypes.includes(newType) || defaultVenueOptions.includes(newType)) return;
                  setVenueTypes([...venueTypes, newType]);
                  setHasVenueChanges(true);
                }}
                value={venueTypes.map(ft => ({ value: ft, label: ft }))} // ✅ koi "Default" nahi

                isSearchable
                closeMenuOnSelect={false}
                menuIsOpen={venueMenuOpen && venueTypes.length + defaultVenueOptions.length > 0} onMenuOpen={() => setVenueMenuOpen(true)}
                onMenuClose={() => setVenueMenuOpen(false)}
                styles={{
                  control: (base) => ({ ...base, borderRadius: "10px", borderColor: "#ccc", padding: "3px" }),
                }}
                formatCreateLabel={(inputValue) => `${inputValue} ➕`}
              />

              {hasVenueChanges && (
                <button
                  type="button"
                  style={{ marginTop: "15px" }}
                  onClick={async () => {
                    if (!adminProfile) return;
                    const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
                    await updateDoc(adminProfileRef, { venueTypes });
                    setHasVenueChanges(false);
                  }}
                  className={styles.button}
                >
                  Save Update
                </button>
              )}
            </div>

            {/* ---------- Function Types ---------- */}
            <div className={styles.fieldRow} style={{
              marginBottom: "20px",
              paddingBottom: "15px",
              borderBottom: "1px dashed #cbd5e1",
            }}>
              <label htmlFor="functionType" className={styles.subHeading}>
                Function Types:
              </label>

              {/* Display saved function types */}
              <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {adminProfile?.functionTypes?.map(ft => (
                  <span key={ft} style={{
                    padding: "4px 8px",
                    backgroundColor: "#e0f7fa",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}>
                    {ft}
                  </span>
                ))}
              </div>

              <CreatableSelect
                isMulti
                components={{
                  ...animatedComponents,
                  DropdownIndicator: (props) => (
                    <div
                      {...props.innerProps}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFunctionMenuOpen(prev => !prev);
                        setVenueMenuOpen(false); // close venue dropdown if open
                      }}
                      style={{ cursor: "pointer", paddingRight: "8px", display: "flex", alignItems: "center" }}
                    >
                      {functionMenuOpen ? "▲" : "▼"}
                    </div>
                  ),
                  ClearIndicator: () => null,
                }}
                options={[
                  ...defaultFunctionOptions.map(ft => ({ value: ft, label: ft })),
                  ...functionTypes.filter(ft => !defaultFunctionOptions.includes(ft)).map(ft => ({ value: ft, label: ft }))
                ]}
                className={styles.selectBox}
                placeholder="Select or add function types..."

                onChange={(selected) => {
                  const selectedValues = selected ? selected.map(s => s.value) : [];
                  setFunctionTypes(selectedValues); // ✅ sirf selected values
                  setHasFunctionChanges(JSON.stringify(selectedValues) !== JSON.stringify(adminProfile?.functionTypes || []));
                }}
                onCreateOption={(inputValue) => {
                  const newType = inputValue.trim();
                  if (!newType || functionTypes.includes(newType) || defaultFunctionOptions.includes(newType)) return;
                  setFunctionTypes([...functionTypes, newType]);
                  setHasFunctionChanges(true);
                }}
                value={functionTypes.map(ft => ({ value: ft, label: ft }))} // ✅ koi "Default" nahi

                isSearchable
                closeMenuOnSelect={false}
                menuIsOpen={functionMenuOpen && functionTypes.length + defaultFunctionOptions.length > 0}
                onMenuOpen={() => setFunctionMenuOpen(true)}
                onMenuClose={() => setFunctionMenuOpen(false)}
                styles={{
                  control: (base) => ({ ...base, borderRadius: "10px", borderColor: "#ccc", padding: "3px" }),
                }}
                formatCreateLabel={(inputValue) => `${inputValue} ➕`}
              />

              {hasFunctionChanges && (
                <button
                  type="button"
                  style={{ marginTop: "15px" }}
                  onClick={async () => {
                    if (!adminProfile) return;
                    const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
                    await updateDoc(adminProfileRef, { functionTypes });
                    setHasFunctionChanges(false);
                  }}
                  className={styles.button}
                >
                  Save Update
                </button>
              )}
            </div>

            {/* ---------- Complimentary Booking Amenities ---------- */}
            <div
              className={styles.fieldRow}
              style={{
                marginBottom: "20px",
                paddingBottom: "15px",
                borderBottom: "1px dashed #cbd5e1",
              }}
            >
              <label htmlFor="amenities" className={styles.subHeading}>
                Complimentary Booking Amenities:
              </label>

              {/* ✅ Display saved amenities */}
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {adminProfile?.amenities?.length > 0 ? (
                  adminProfile.amenities.map((am) => (
                    <span
                      key={am}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#f1f8e9",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {am}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#888", fontSize: "0.85rem" }}>
                    No amenities saved yet.
                  </span>
                )}
              </div>

              {/* ✅ Editable dropdown */}
              <CreatableSelect
                isMulti
                components={{
                  ...animatedComponents,
                  DropdownIndicator: (props) => (
                    <div
                      {...props.innerProps}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAmenitiesMenuOpen((prev) => !prev);
                        setFunctionMenuOpen(false);
                        setVenueMenuOpen(false);
                      }}
                      style={{
                        cursor: "pointer",
                        paddingRight: "8px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {amenitiesMenuOpen ? "▲" : "▼"}
                    </div>
                  ),
                  ClearIndicator: () => null,
                }}
                options={[
                  ...defaultAmenityOptions.map((am) => ({ value: am, label: am })),
                  ...(amenities?.filter(
                    (am) => !defaultAmenityOptions.includes(am)
                  ) || []).map((am) => ({ value: am, label: am })),
                ]}
                className={styles.selectBox}
                placeholder="Select or add amenities..."
                onChange={(selected) => {
                  const selectedValues = selected ? selected.map((s) => s.value) : [];
                  setAmenities(selectedValues);
                  setHasAmenitiesChanges(
                    JSON.stringify(selectedValues) !==
                    JSON.stringify(adminProfile?.amenities || [])
                  );
                }}
                onCreateOption={(inputValue) => {
                  const newAmenity = inputValue.trim();
                  if (
                    !newAmenity ||
                    amenities.includes(newAmenity) ||
                    defaultAmenityOptions.includes(newAmenity)
                  )
                    return;
                  setAmenities([...amenities, newAmenity]);
                  setHasAmenitiesChanges(true);
                }}
                value={amenities.map((am) => ({ value: am, label: am }))}
                isSearchable
                closeMenuOnSelect={false}
                menuIsOpen={
                  amenitiesMenuOpen && amenities.length + defaultAmenityOptions.length > 0
                }
                onMenuOpen={() => setAmenitiesMenuOpen(true)}
                onMenuClose={() => setAmenitiesMenuOpen(false)}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: "10px",
                    borderColor: "#ccc",
                    padding: "3px",
                  }),
                }}
                formatCreateLabel={(inputValue) => `${inputValue} ➕`}
              />

              {hasAmenitiesChanges && (
                <button
                  type="button"
                  style={{ marginTop: "15px" }}
                  onClick={async () => {
                    if (!adminProfile) return;
                    const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
                    await updateDoc(adminProfileRef, { amenities });
                    setHasAmenitiesChanges(false);
                  }}
                  className={styles.button}
                >
                  Save Update
                </button>
              )}
            </div>

            {/* ---------- Add-Ons Charges ---------- */}
            <div
              className={styles.fieldRow}
              style={{
                marginBottom: "20px",
                paddingBottom: "15px",
                borderBottom: "1px dashed #cbd5e1",
              }}
            >
              <label htmlFor="addons" className={styles.subHeading}>
                Add-Ons Charges:
              </label>

              {/* ✅ Display saved Add-ons */}
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {adminProfile?.addons?.length > 0 ? (
                  adminProfile.addons.map((ad) => (
                    <span
                      key={ad}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#e8f5e9",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {ad}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#888", fontSize: "0.85rem" }}>
                    No add-ons saved yet.
                  </span>
                )}
              </div>

              <CreatableSelect
                isMulti
                components={{
                  ...animatedComponents,
                  DropdownIndicator: (props) => (
                    <div
                      {...props.innerProps}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFunctionMenuOpen(false);
                        setVenueMenuOpen(false);
                        setAmenitiesMenuOpen(false);
                        setAddonsMenuOpen((prev) => !prev);
                      }}
                      style={{
                        cursor: "pointer",
                        paddingRight: "8px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {addonsMenuOpen ? "▲" : "▼"}
                    </div>
                  ),
                  ClearIndicator: () => null,
                }}
                options={[
                  ...defaultAddonsOptions.map((a) => ({ value: a, label: a })),
                  ...(addons?.filter((a) => !defaultAddonsOptions.includes(a)) || []).map(
                    (a) => ({ value: a, label: a })
                  ),
                ]}
                className={styles.selectBox}
                placeholder="Select or add Add-Ons..."
                onChange={(selected) => {
                  const selectedValues = selected ? selected.map((s) => s.value) : [];
                  setAddons(selectedValues);
                  setHasAddonsChanges(
                    JSON.stringify(selectedValues) !==
                    JSON.stringify(adminProfile?.addons || [])
                  );
                }}
                onCreateOption={(inputValue) => {
                  const newAddon = inputValue.trim();
                  if (
                    !newAddon ||
                    addons.includes(newAddon) ||
                    defaultAddonsOptions.includes(newAddon)
                  )
                    return;
                  setAddons([...addons, newAddon]);
                  setHasAddonsChanges(true);
                }}
                value={addons.map((a) => ({ value: a, label: a }))}
                isSearchable
                closeMenuOnSelect={false}
                menuIsOpen={addonsMenuOpen && addons.length + defaultAddonsOptions.length > 0}
                onMenuOpen={() => setAddonsMenuOpen(true)}
                onMenuClose={() => setAddonsMenuOpen(false)}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: "10px",
                    borderColor: "#ccc",
                    padding: "3px",
                  }),
                }}
                formatCreateLabel={(inputValue) => `${inputValue} ➕`}
              />

              {hasAddonsChanges && (
                <button
                  type="button"
                  style={{ marginTop: "15px" }}
                  onClick={async () => {
                    if (!adminProfile) return;
                    const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
                    await updateDoc(adminProfileRef, { addons });
                    setHasAddonsChanges(false);
                  }}
                  className={styles.button}
                >
                  Save Update
                </button>
              )}
            </div>

            {/* ---------- Menu Item Charges ---------- */}
            <div
              className={styles.fieldRow}
              style={{
                marginBottom: "20px",
                paddingBottom: "15px",
                borderBottom: "1px dashed #cbd5e1",
              }}
            >
              <label htmlFor="menuItems" className={styles.subHeading}>
                Menu Item Charges:
              </label>

              {/* ✅ Display saved menu items */}
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {adminProfile?.menuItems?.length > 0 ? (
                  adminProfile.menuItems.map((mi) => (
                    <span
                      key={mi}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#e3f2fd",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {mi}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#888", fontSize: "0.85rem" }}>
                    No menu items saved yet.
                  </span>
                )}
              </div>

              <CreatableSelect
                isMulti
                components={{
                  ...animatedComponents,
                  DropdownIndicator: (props) => (
                    <div
                      {...props.innerProps}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFunctionMenuOpen(false);
                        setVenueMenuOpen(false);
                        setAmenitiesMenuOpen(false);
                        setMenuItemsMenuOpen((prev) => !prev);
                      }}
                      style={{
                        cursor: "pointer",
                        paddingRight: "8px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {menuItemsMenuOpen ? "▲" : "▼"}
                    </div>
                  ),
                  ClearIndicator: () => null,
                }}
                options={[
                  ...defaultMenuItemOptions.map((m) => ({ value: m, label: m })),
                  ...(menuItems?.filter((m) => !defaultMenuItemOptions.includes(m)) || []).map(
                    (m) => ({ value: m, label: m })
                  ),
                ]}
                className={styles.selectBox}
                placeholder="Select or add Menu Items..."
                onChange={(selected) => {
                  const selectedValues = selected ? selected.map((s) => s.value) : [];
                  setMenuItems(selectedValues);
                  setHasMenuItemsChanges(
                    JSON.stringify(selectedValues) !==
                    JSON.stringify(adminProfile?.menuItems || [])
                  );
                }}
                onCreateOption={(inputValue) => {
                  const newMenuItem = inputValue.trim();
                  if (
                    !newMenuItem ||
                    menuItems.includes(newMenuItem) ||
                    defaultMenuItemOptions.includes(newMenuItem)
                  )
                    return;
                  setMenuItems([...menuItems, newMenuItem]);
                  setHasMenuItemsChanges(true);
                }}
                value={menuItems.map((m) => ({ value: m, label: m }))}
                isSearchable
                closeMenuOnSelect={false}
                menuIsOpen={
                  menuItemsMenuOpen && menuItems.length + defaultMenuItemOptions.length > 0
                }
                onMenuOpen={() => setMenuItemsMenuOpen(true)}
                onMenuClose={() => setMenuItemsMenuOpen(false)}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: "10px",
                    borderColor: "#ccc",
                    padding: "3px",
                  }),
                }}
                formatCreateLabel={(inputValue) => `${inputValue} ➕`}
              />

              {hasMenuItemsChanges && (
                <button
                  type="button"
                  style={{ marginTop: "15px" }}
                  onClick={async () => {
                    if (!adminProfile) return;
                    const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
                    await updateDoc(adminProfileRef, { menuItems });
                    setHasMenuItemsChanges(false);
                  }}
                  className={styles.button}
                >
                  Save Update
                </button>
              )}
            </div>


          </>
        ) : (
          <div className={styles.container}>
            {loading ? (
              <div className={styles.spinnerContainer}>
                <div className={styles.spinner}></div>
              </div>
            ) : !adminProfile ? (
              <p className={styles.message}>Pls Login With Admin/ Partner Profile profile...</p>
            ) : (
              <div>
                <h2>Welcome, {adminProfile.name}</h2>
              </div>
            )}
          </div>)}
        <div style={{ marginBottom: "150px" }}></div>
      </div>
      <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
    </>
  );
};

export default AdminProfile;