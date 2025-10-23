import React, { useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';

const LeadSummary = forwardRef(({
    selectedMenus,
    customItems = [],
    customMenuCharges = [],
    hallCharges,
    gstBase,
    setGstBase,
    setTotalAmount,
    setGstAmount,
    setGrandTotal,
    totalAmount,
    gstAmount,
    grandTotal,
    meals,
    discount,
    setDiscount,
    commission,
    setCommission
}, ref) => {

    const safeToFixed = (value, digits = 0) => {
        const num = parseFloat(value);
        return isNaN(num) ? '0' : num.toFixed(digits);
    };

    // ab validateSummary me GST compulsory check hata diya
    useImperativeHandle(ref, () => ({
        validateSummary: () => true
    }));

    const validMenus = useMemo(() => {
        return Object.fromEntries(
            Object.entries(selectedMenus || {}).filter(
                ([_, val]) => (val?.rate > 0) && (val?.total > 0)
            )
        );
    }, [selectedMenus]);


    const mealTotal = useMemo(() => {
        if (!meals) return 0;

        return Object.entries(meals)
            .filter(([key]) => key !== "No. of days")
            .reduce((daySum, [_, dayMeals]) => {
                if (!dayMeals || typeof dayMeals !== "object") return daySum;

                const totalForDay = Object.values(dayMeals).reduce((mealSum, meal) => {
                    if (!meal || typeof meal !== "object") return mealSum;
                    return mealSum + (meal.total || 0);
                }, 0);

                return daySum + totalForDay;
            }, 0);
    }, [meals]);


    useEffect(() => {
        const menuTotal = Object.values(validMenus).reduce((sum, item) => sum + (item?.total || 0), 0);
        const customCharges = customItems.reduce((sum, item) => sum + (item.total || 0), 0);
        const menuCharges = customMenuCharges.reduce(
            (sum, item) => sum + parseFloat(item.total || 0),
            0
        );

        const hall = parseFloat(hallCharges || 0);
        const base = parseFloat(gstBase || 0);
        const disc = parseFloat(discount || 0);

        const total = menuTotal + hall + customCharges + mealTotal + menuCharges - disc;
        const gst = base * 0.18;
        const grand = total + gst;

        setTotalAmount(total);
        setGstAmount(gst);
        setGrandTotal(grand);
    }, [
        validMenus,
        customItems,
        customMenuCharges,
        hallCharges,
        gstBase,
        discount,
        mealTotal,
        setTotalAmount,
        setGstAmount,
        setGrandTotal
    ]);

    return (
        <div>
            {[{ label: "Total Amount", value: totalAmount }].map(({ label, value }, i) => (
                <div className="form-group" key={i}>
                    <label>{label}</label>
                    <input type="number" value={safeToFixed(value)} disabled />
                </div>
            ))}

            <div className="form-group">
                <label>Commission</label>
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder=""
                    value={commission || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        setCommission(val);
                    }}
                />
            </div>

            <div className="form-group">
                <label>Discount</label>
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder=""
                    value={discount || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        setDiscount(val);
                    }}
                />
            </div>


            <div className="form-group">
                <label>GST Applicable Amount</label>
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder=""
                    value={gstBase || ""}
                    onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9.]/g, "");
                        if ((val.match(/\./g) || []).length > 1) val = val.slice(0, -1);
                        setGstBase(val);
                    }}
                />
            </div>

            {[{ label: "GST (18%)", value: gstAmount }].map(({ label, value }, i) => (
                <div className="form-group" key={i}>
                    <label>{label}</label>
                    <input type="number" value={safeToFixed(value)} disabled />
                </div>
            ))}

            <div className="form-group">
                <label>Grand Total</label>
                <input type="number" value={safeToFixed(grandTotal)} disabled />
            </div>
        </div>
    );
});

export default LeadSummary;