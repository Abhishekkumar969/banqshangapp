import React, { useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';

const LeadSummary = forwardRef(({
    selectedMenus,
    hallCharges,
    gstBase,
    setGstBase,
    setTotalAmount,
    setGstAmount,
    setGrandTotal,
    meals,
    setSummaryData
}, ref) => {

    // Safely format number
    const safeToFixed = (value, digits = 0) => {
        const num = parseFloat(value);
        return isNaN(num) ? '0' : num.toFixed(digits);
    };

    useImperativeHandle(ref, () => ({
        validateSummary: () => true
    }));

    // ✅ Calculate meal total across days
    const mealTotal = useMemo(() => {
        if (!meals) return 0;

        return Object.values(meals).reduce((daySum, dayMeals) => {
            if (!dayMeals || typeof dayMeals !== "object") return daySum;

            const totalForDay = Object.values(dayMeals).reduce((mealSum, meal) => {
                if (meal && typeof meal === "object") {
                    // Use total if present, otherwise fallback to pax * rate
                    const mealAmount = meal.total ?? (parseFloat(meal.pax || 0) * parseFloat(meal.rate || 0));
                    return mealSum + mealAmount;
                }
                return mealSum;
            }, 0);

            return daySum + totalForDay;
        }, 0);
    }, [meals]);

    // ✅ Always derive summaries from props + mealTotal
    const summaries = useMemo(() => {
        const hall = parseFloat(hallCharges || 0);
        const gstAmount = parseFloat(gstBase || 0) * 0.18;

        return Object.entries(selectedMenus).map(([menuName, item]) => {
            const total = parseFloat(item?.total || 0);
            const grandTotal = total + hall + mealTotal + gstAmount;

            return {
                menuName,
                menuTotal: total,
                mealTotal,
                gstBase: parseFloat(gstBase || 0),
                grandTotal
            };
        });
    }, [selectedMenus, hallCharges, gstBase, mealTotal]);

    // ✅ push data to parent when summaries change
    useEffect(() => {
        const totalAmount = summaries.reduce((sum, cur) => sum + cur.menuTotal, 0);
        const gstAmount = parseFloat(gstBase || 0) * 0.18;
        const grandTotalAll = summaries.reduce((sum, cur) => sum + cur.grandTotal, 0);

        setTotalAmount(totalAmount);
        setGstAmount(gstAmount);
        setGrandTotal(grandTotalAll);
        setSummaryData(summaries);

        console.log("MealTotal Updated 👉", mealTotal, "Summaries 👉", summaries);
    }, [summaries, gstBase, mealTotal, setTotalAmount, setGstAmount, setGrandTotal, setSummaryData]);

    return (
        <div style={{ marginTop: '20px' }}>
            {summaries.map(({ menuName, menuTotal, grandTotal }) => {
                const hall = parseFloat(hallCharges || 0);
                const gst = parseFloat(gstBase || 0) * 0.18;

                return (
                    <div
                        key={menuName}
                        className="summary-section"
                        style={{
                            padding: '16px',
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            backgroundColor: '#f9f9f9',
                        }}
                    >
                        <h4>Summary for: {menuName}</h4>

                        <div className="form-group">
                            <label>{menuName}</label>
                            <input type="number" value={menuTotal} disabled />
                        </div>

                        <div className="form-group">
                            <label>Meal Amount</label>
                            <input type="number" value={safeToFixed(mealTotal, 0)} disabled />
                        </div>

                        <div className="form-group">
                            <label>Venue Charges</label>
                            <input type="number" value={safeToFixed(hall, 0)} disabled />
                        </div>

                        <div className="form-group">
                            <label>Total (Menu + Meal + Venue)</label>
                            <input type="number" value={safeToFixed(menuTotal + hall + mealTotal, 0)} disabled />
                        </div>

                        <div className="form-group">
                            <label>GST Applicable Amount</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder=""
                                value={gstBase}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9.]/g, "");
                                    if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                                    setGstBase(val);
                                }}
                            />
                        </div>


                        <div className="form-group">
                            <label>GST (18%)</label>
                            <input type="number" value={safeToFixed(gst, 0)} disabled />
                        </div>

                        <div className="form-group">
                            <label>Grand Total (Menu + Venue + Meal + GST)</label>
                            <input type="number" value={safeToFixed(grandTotal, 0)} disabled />
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

export default LeadSummary;
