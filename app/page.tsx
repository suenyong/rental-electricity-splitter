"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";

type Room = { id: number; name: string; usage: string; people: string };
type CalculationInput = { billAmount: string; billUsage: string; rooms: Room[] };
type Stats = { views: number; calculations: number };

const money = new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 3 });

export default function Home() {
  const [billAmount, setBillAmount] = useState("");
  const [billUsage, setBillUsage] = useState("");
  const [nextId, setNextId] = useState(4);
  const [rooms, setRooms] = useState<Room[]>([
    { id: 1, name: "房間 1", usage: "", people: "1" },
    { id: 2, name: "房間 2", usage: "", people: "1" },
    { id: 3, name: "房間 3", usage: "", people: "1" },
  ]);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitted, setSubmitted] = useState<CalculationInput | null>(null);
  const [stats, setStats] = useState<Stats>({ views: 0, calculations: 0 });
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener("beforeinstallprompt", handler);
    fetch("/api/stats?track=view", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: Stats | null) => { if (data) setStats(data); })
      .catch(() => undefined);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const result = useMemo(() => {
    if (!submitted) return null;
    const amount = Math.max(0, Number(submitted.billAmount) || 0);
    const totalKwh = Math.max(0, Number(submitted.billUsage) || 0);
    const usages = submitted.rooms.map((room) => Math.max(0, Number(room.usage) || 0));
    const people = submitted.rooms.map((room) => Math.max(1, Math.floor(Number(room.people) || 1)));
    const privateKwh = usages.reduce((sum, value) => sum + value, 0);
    const totalPeople = people.reduce((sum, value) => sum + value, 0);
    if (!amount || !totalKwh) return null;
    if (privateKwh > totalKwh) return { error: "各房用電合計不可大於帳單總用電度數。" } as const;

    const rate = amount / totalKwh;
    const commonKwh = totalKwh - privateKwh;
    const commonFee = commonKwh * rate;
    const commonPerPerson = commonFee / totalPeople;
    const privateFees = usages.map((usage) => usage * rate);
    const exactShares = privateFees.map((fee, index) => fee + people[index] * commonPerPerson);
    const shares = exactShares.map(Math.floor);
    let remainder = Math.round(amount) - shares.reduce((sum, value) => sum + value, 0);
    const order = exactShares.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < remainder; i += 1) shares[order[i % order.length].index] += 1;

    return { amount, totalKwh, usages, people, rooms: submitted.rooms, privateKwh, totalPeople, rate, commonKwh, commonFee, commonPerPerson, privateFees, exactShares, shares };
  }, [submitted]);

  function updateRoom(id: number, field: "name" | "usage" | "people", value: string) {
    setRooms((current) => current.map((room) => room.id === id ? { ...room, [field]: value } : room));
  }

  function addRoom() {
    setRooms((current) => [...current, { id: nextId, name: `房間 ${current.length + 1}`, usage: "", people: "1" }]);
    setNextId((value) => value + 1);
  }

  function calculate() {
    const snapshot = { billAmount, billUsage, rooms: rooms.map((room) => ({ ...room })) };
    setSubmitted(snapshot);
    if (Number(billAmount) > 0 && Number(billUsage) > 0) {
      fetch("/api/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "calculate" }) })
        .then((response) => response.ok ? response.json() : null)
        .then((data: Stats | null) => { if (data) setStats(data); })
        .catch(() => undefined);
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await (installPrompt as Event & { prompt: () => Promise<void> }).prompt();
    setInstallPrompt(null);
  }

  async function downloadScreenshot() {
    if (!captureRef.current || !validResult) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: "#f7f9f7",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `分租電費-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setCapturing(false);
    }
  }

  const validResult = result && !("error" in result) ? result : null;

  return (
    <main>
      <header>
        <a className="brand" href="#top" aria-label="分電首頁"><span>分電</span><i /></a>
        <div className="header-meta"><span>瀏覽 {stats.views.toLocaleString()} 次</span><span>已計算 {stats.calculations.toLocaleString()} 次</span>{installPrompt && <button className="secondary small" onClick={installApp}>安裝到手機</button>}</div>
      </header>

      <section className="intro" id="top">
        <span className="label">分租電費計算器</span>
        <h1>每一度，都算清楚。</h1>
        <p>房內用電各自負擔，公共用電依實際居住人數平均分攤。</p>
      </section>

      <section className="panel">
        <div className="panel-title"><span className="step">01</span><div><h2>輸入帳單</h2><p>請從電費帳單上找到總金額與總用電度數</p></div></div>
        <div className="bill-grid">
          <label>帳單總金額<div className="field"><span>NT$</span><input type="number" min="0" inputMode="decimal" placeholder="例如 3,600" value={billAmount} onChange={(event) => setBillAmount(event.target.value)} /></div></label>
          <label>帳單總用電<div className="field"><input type="number" min="0" inputMode="decimal" placeholder="例如 800" value={billUsage} onChange={(event) => setBillUsage(event.target.value)} /><span>度</span></div></label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title row"><span className="step">02</span><div><h2>房間資料</h2><p>房內人數會影響公共電費分攤</p></div><button className="secondary add" onClick={addRoom}>＋ 增加房間</button></div>
        <div className="room-table">
          <div className="table-head"><span>房間名稱</span><span>房內用電</span><span>居住人數</span><span /></div>
          {rooms.map((room) => (
            <div className="room" key={room.id}>
              <input aria-label="房間名稱" value={room.name} onChange={(event) => updateRoom(room.id, "name", event.target.value)} />
              <div className="compact"><input aria-label={`${room.name}房內用電`} type="number" min="0" inputMode="decimal" placeholder="0" value={room.usage} onChange={(event) => updateRoom(room.id, "usage", event.target.value)} /><span>度</span></div>
              <div className="compact"><input aria-label={`${room.name}居住人數`} type="number" min="1" step="1" inputMode="numeric" value={room.people} onChange={(event) => updateRoom(room.id, "people", event.target.value)} /><span>人</span></div>
              <button className="remove" aria-label={`刪除${room.name}`} disabled={rooms.length === 1} onClick={() => setRooms((current) => current.filter((item) => item.id !== room.id))}>刪除</button>
            </div>
          ))}
        </div>
      </section>

      <button className="calculate" onClick={calculate}>開始計算電費</button>

      <div className="result-actions"><div><span className="step green">03</span><h2>計算結果</h2></div><button className="screenshot" disabled={!validResult || capturing} onClick={downloadScreenshot}>{capturing ? "產生中…" : "下載結果截圖"}</button></div>
      <div ref={captureRef} className="capture-area">
      <section className="result-section" aria-live="polite">
        {result && "error" in result ? <div className="error">{result.error}</div> : validResult ? (
          <>
            <div className="summary">
              <div><span>平均每度</span><strong>{money.format(validResult.rate)}</strong></div>
              <div><span>房內用電合計</span><strong>{decimal.format(validResult.privateKwh)} 度</strong></div>
              <div><span>公共用電</span><strong>{decimal.format(validResult.commonKwh)} 度</strong></div>
              <div><span>公共電費／人</span><strong>{money.format(validResult.commonPerPerson)}</strong></div>
            </div>
            <div className="result-list">
              {validResult.rooms.map((room, index) => (
                <article key={room.id}>
                  <div className="result-main"><div><span>{room.name || `房間 ${index + 1}`}</span><small>{validResult.people[index]} 人</small></div><strong>{money.format(validResult.shares[index])}</strong></div>
                  <div className="room-formula">
                    <span>房內電費：{decimal.format(validResult.usages[index])} 度 × {money.format(validResult.rate)} ＝ {money.format(validResult.privateFees[index])}</span>
                    <span>公共電費：{validResult.people[index]} 人 × {money.format(validResult.commonPerPerson)} ＝ {money.format(validResult.people[index] * validResult.commonPerPerson)}</span>
                    <b>合計：{money.format(validResult.privateFees[index])} ＋ {money.format(validResult.people[index] * validResult.commonPerPerson)} ＝ {money.format(validResult.exactShares[index])}</b>
                    {validResult.people[index] > 1 && <strong className="per-person">每人應付：{money.format(validResult.exactShares[index])} ÷ {validResult.people[index]} 人 ＝ {money.format(validResult.exactShares[index] / validResult.people[index])}</strong>}
                  </div>
                </article>
              ))}
            </div>
            <div className="total-check">各房應付金額加總 <strong>{money.format(validResult.shares.reduce((sum, value) => sum + value, 0))}</strong></div>
          </>
        ) : <div className="empty">輸入帳單資料後，結果會顯示在這裡。</div>}
      </section>

      <section className="formula-panel">
        <h2>完整計算公式</h2>
        <ol>
          <li><b>平均每度電價</b><code>帳單總金額 ÷ 帳單總用電度數</code></li>
          <li><b>公共用電度數</b><code>帳單總用電度數 − 所有房間用電度數合計</code></li>
          <li><b>每人公共電費</b><code>公共用電度數 × 平均每度電價 ÷ 總居住人數</code></li>
          <li><b>各房應付電費</b><code>房內用電度數 × 平均每度電價 ＋ 房內人數 × 每人公共電費</code></li>
        </ol>
        <p>帳單內的基本費、燃料費與其他調整項目，已包含在「平均每度電價」中。最終金額以元為單位四捨五入，尾差會自動調整，使各房合計與帳單一致。</p>
      </section>
      </div>
      <footer>資料僅在本次頁面中計算，不會上傳或儲存。</footer>
    </main>
  );
}
