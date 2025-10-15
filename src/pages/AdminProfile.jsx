import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import styles from "../styles/vendorProfile.module.css";

const AdminProfile = () => {
  const [adminProfile, setAdminProfile] = useState(null);
  const [items, setItems] = useState({});
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [functionTypes, setFunctionTypes] = useState(["Default"]);
  const [newFunctionType, setNewFunctionType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 10000);
    const auth = getAuth();
    let hasFetched = false; // ✅ add this

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email && !hasFetched) {
        hasFetched = true; // ✅ prevents re-fetch
        try {
          const q = query(
            collection(db, "usersAccess"),
            where("email", "==", user.email),
            where("accessToApp", "in", ["A", "D"])
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            const data = docSnap.data();
            setAdminProfile({ id: docSnap.id, ...data });
            setItems(data.items || {});
            setFunctionTypes(
              data.functionTypes ? ["Default", ...data.functionTypes] : ["Default"]
            );
          } else {
            console.warn("❌ No Admin Profile record found for this user.");
          }
        } catch (error) {
          console.error("🔥 Error fetching Admin Profile:", error);
        }
      }
    });

    return () => {
      unsubscribe();
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

  const handleDeleteField = async (field) => {
    if (!adminProfile) return;
    try {
      const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
      await updateDoc(adminProfileRef, { [field]: "" });
      setAdminProfile({ ...adminProfile, [field]: "" });
    } catch (error) {
      console.error("Error deleting field:", error);
    }
  };

  const handleAddFunctionType = async () => {
    if (!newFunctionType.trim() || !adminProfile) return;

    const newType = newFunctionType.trim();

    if (functionTypes.includes(newType)) return; // prevent duplicates

    const updatedFunctionTypes = [...functionTypes, newType];
    const updatedItems = { ...items, [newType]: [] };

    try {
      const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
      await updateDoc(adminProfileRef, { functionTypes: updatedFunctionTypes.filter(ft => ft !== "Default"), items: updatedItems });
      setFunctionTypes(updatedFunctionTypes);
      setItems(updatedItems);
      setNewFunctionType("");
    } catch (error) {
      console.error("Error adding function type:", error);
    }
  };

  return (
    <div className={styles.container}>
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

          <div className={styles.adminProfileInfo}>
            {["firmName", "address", "contactNo", "termsAndConditions"].map((field) => (
              <div key={field} className={styles.fieldRow}>
                {editField === field ? (
                  <>
                    <div>
                      <div>
                        <strong style={{ whiteSpace: "nowrap" }}>
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

                      <div>
                        <span>
                          <strong style={{ color: "orangered", marginLeft: "10px" }}>
                            {adminProfile[field] || "Not Filled"}
                          </strong>
                        </span>
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
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className={styles.editInput}
                        />
                      )}
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
                  </>
                ) : (
                  <>
                    <div>
                      <div>
                        <strong style={{ whiteSpace: "nowrap" }}>
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

                      <div style={{ marginLeft: "10px" }}>
                        {field === "termsAndConditions" ? (
                          <div
                            style={{
                              color: "green",
                              textTransform: "none",
                              whiteSpace: "pre-line",
                              fontWeight: 'bold'
                            }}
                          >
                            {adminProfile[field] || "Not Filled"}
                          </div>
                        ) : (
                          <strong style={{ color: "green", textTransform: "capitalize" }}>
                            {adminProfile[field] || "Not Filled"}
                          </strong>
                        )}
                      </div>
                    </div>

                    <div className={styles.itemButtons}>
                      <button type="button"
                        onClick={() => {
                          setEditField(field);
                          setEditValue(adminProfile[field] || "");
                        }}
                        className={styles.editButton}
                      >
                        Edit
                      </button>
                      <button type="button"
                        onClick={() => handleDeleteField(field)}
                        className={styles.deleteButton}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Dynamic Function Types - All in one line */}
            <div className={styles.fieldRow}>
              <strong style={{ whiteSpace: "nowrap", marginRight: "10px" }}>Function Types:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {functionTypes
                  .filter(ft => ft !== "Default")
                  .map(ft => (
                    <div key={ft} style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#f0f0f0", padding: "5px 10px", borderRadius: "8px" }}>
                      {editField === ft ? (
                        <>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className={styles.editInput}
                            style={{ width: "100px" }}
                          />
                          <button type="button"
                            onClick={async () => {
                              if (!editValue.trim() || !adminProfile) return;
                              const updatedFunctions = functionTypes.map(f => f === ft ? editValue.trim() : f);
                              const updatedItems = { ...items };
                              if (updatedItems[ft]) {
                                updatedItems[editValue.trim()] = updatedItems[ft];
                                delete updatedItems[ft];
                              }
                              const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
                              await updateDoc(adminProfileRef, { functionTypes: updatedFunctions.filter(f => f !== "Default"), items: updatedItems });
                              setFunctionTypes(updatedFunctions);
                              setItems(updatedItems);
                              setEditField(null);
                              setEditValue("");
                            }}
                            className={styles.saveButton}
                          >Save</button>
                          <button type="button"
                            onClick={() => setEditField(null)}
                            className={styles.cancelButton}
                          >Cancel</button>
                        </>
                      ) : (
                        <>
                          <span>{ft}</span>
                          <button type="button"
                            onClick={() => {
                              setEditField(ft);
                              setEditValue(ft);
                            }}
                            className={styles.editButton}
                            style={{ padding: "2px 5px", fontSize: "0.8rem" }}
                          >✏️
                          </button>

                          <button type="button"
                            onClick={async () => {
                              if (!adminProfile) return;
                              const updatedFunctions = functionTypes.filter(f => f !== ft);
                              const updatedItems = { ...items };
                              delete updatedItems[ft];
                              const adminProfileRef = doc(db, "usersAccess", adminProfile.id);
                              await updateDoc(adminProfileRef, { functionTypes: updatedFunctions.filter(f => f !== "Default"), items: updatedItems });
                              setFunctionTypes(updatedFunctions);
                              setItems(updatedItems);
                            }}
                            className={styles.deleteButton}
                            style={{ padding: "2px 5px", fontSize: "0.8rem" }}
                          >🗑️
                          </button>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className={styles.InsertFields}>
            <div>
              <label htmlFor="functionType" className={styles.subHeading}>
                Add Function Type:
              </label>
              <input
                type="text"
                placeholder="Add new function type"
                value={newFunctionType}
                onChange={(e) => setNewFunctionType(e.target.value)}
                className={styles.inputBox}
              />
              <button type="button"
                style={{ marginTop: "15px" }}
                onClick={handleAddFunctionType}
                className={styles.button}
              >
                Add
              </button>
            </div>
          </div>

        </>
      ) : (
        <div className={styles.container}>
          {loading ? (
            <div className={styles.spinnerContainer}>
              <div className={styles.spinner}></div>
            </div>
          ) : !adminProfile ? (
            <p className={styles.message}>Pls Login With Admin Profile profile...</p>
          ) : (
            <div>
              <h2>Welcome, {adminProfile.name}</h2>
            </div>
          )}
        </div>)}
    </div>
  );
};

export default AdminProfile;
