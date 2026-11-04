import React, { useEffect, useState } from "react";

export default function CancelReasonModal({ isOpen, title = "ยกเลิกเคส", reasons, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) { setReason(""); setNote(""); setError(""); setBusy(false); }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) return setError("กรุณาเลือกเหตุผลในการยกเลิก");
    if (reason === "other" && !note.trim()) return setError("กรุณาระบุเหตุผลเพิ่มเติม");
    setBusy(true);
    try {
      await onConfirm({ reason, note });
      onClose();
    } catch (err) {
      console.error(err);
      setError("ยกเลิกเคสไม่สำเร็จ กรุณาลองใหม่");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={busy ? undefined : onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-1">เลือกเหตุผล เคสจะถูกเก็บไว้ในประวัติพร้อมเหตุผลนี้</p>
        </div>

        <div className="space-y-2">
          {reasons.map((r) => (
            <label key={r.value}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer text-sm font-semibold transition ${
                reason === r.value ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}>
              <input type="radio" name="cancel-reason" value={r.value}
                checked={reason === r.value}
                onChange={() => { setReason(r.value); setError(""); }}
                className="accent-red-500" />
              {r.label}
            </label>
          ))}
        </div>

        {reason && (
          <textarea value={note} maxLength={200} rows={2}
            onChange={(e) => { setNote(e.target.value); setError(""); }}
            placeholder={reason === "other" ? "ระบุเหตุผล (จำเป็น)" : "หมายเหตุเพิ่มเติม (ไม่บังคับ)"}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
        )}

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-600">
            ไม่ยกเลิก
          </button>
          <button type="submit" disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
            {busy ? "กำลังบันทึก..." : "ยืนยันยกเลิกเคส"}
          </button>
        </div>
      </form>
    </div>
  );
}