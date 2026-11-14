"""VitalOrbit API. Python owns the health rules, XP and reports; React is only the UI."""
import json
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

DB = Path(__file__).with_name("data.json")
G = lambda *a: list(a)
I = {  # w = watch outside range, a = action outside range, bad = harmful direction, t = drift threshold
 "hr": dict(n="Heart rate", u="bpm", w=[50, 90], a=[40, 105], bad=1, t=6, how="Sit still 5 min, then use the sensor or count the pulse for 30 s x2.", g=G("Rest and hydrate, re-measure in 15 min. Check caffeine, stress and cabin CO2.", "Stop activity and re-measure. With dizziness or chest pain call the flight surgeon now.")),
 "sys": dict(n="Systolic BP", u="mmHg", w=[100, 129], a=[90, 139], bad=1, t=8, how="Seated, arm at heart level, after 5 min rest, same arm daily.", g=G("Cut sodium, hydrate, re-measure after 10 min. Fluid shifts can raise or lower BP.", "Re-measure on the other arm, then contact the flight surgeon today.")),
 "dia": dict(n="Diastolic BP", u="mmHg", w=[60, 84], a=[55, 89], bad=1, t=6, how="Read together with systolic from the same cuff measurement.", g=G("Re-measure after rest and log the trend.", "Re-measure, then contact the flight surgeon today.")),
 "spo2": dict(n="Blood oxygen", u="%", w=[95, 100], a=[90, 100], bad=-1, t=2, how="Pulse oximeter on a warm finger, hold still 30 s.", g=G("Warm your hands and re-measure. Check habitat O2 and CO2 readouts.", "Check the air system, move to a ventilated module and call the flight surgeon.")),
 "resp": dict(n="Breathing rate", u="/min", w=[12, 20], a=[8, 26], bad=1, t=3, how="Count breaths for 60 s at rest.", g=G("Re-count at rest. A persistently high rate can signal CO2 build-up or infection.", "Check cabin CO2 and report to the flight surgeon.")),
 "glucose": dict(n="Blood sugar", u="mg/dL", w=[70, 125], a=[60, 160], bad=1, t=12, how="Fingerstick meter, fasting or 2 h after a meal.", g=G("Review meal timing and sugar, re-test fasting tomorrow.", "Re-test now. With thirst, shakiness or confusion contact the flight surgeon.")),
 "temp": dict(n="Body temp", u="C", w=[36.1, 37.5], a=[35.5, 38], bad=1, t=.3, how="Forehead or ear thermometer, 20 min after exercise.", g=G("Re-measure in 30 min. Check habitat temperature and hydration.", "Possible infection or heat stress. Limit crew contact and call the flight surgeon.")),
 "sleep": dict(n="Sleep", u="h", w=[7, 12], a=[5.5, 12], bad=-1, t=1, how="Total hours in the last 24 h.", g=G("Protect an 8 h window, dim lights 1 h before bed, limit screens.", "Fatigue risk: postpone critical tasks, request schedule relief, tell the flight surgeon.")),
 "mood": dict(n="Mood", u="/5", w=[4, 5], a=[3, 5], bad=-1, t=1, how="Rate 1 (very low) to 5 (great).", g=G("Schedule a call with family or a crewmate and some leisure time.", "Reach out to the behavioral health team for a private conference now.")),
 "ex": dict(n="Exercise", u="min", w=[30, 999], a=[10, 999], bad=-1, t=15, how="Minutes of resistive plus aerobic work today.", g=G("Add a short session today; it is the main defense against bone and muscle loss.", "Make a 2-day catch-up plan; low loading speeds up bone loss.")),
}
K = list(I)
REGIONS = {
 "head": dict(n="Brain & behavior", k=["sleep", "mood"], h="Isolation, confinement, shifting light cycles", y="Sleep loss and mood swings are common on long missions and you often notice them first."),
 "chest": dict(n="Heart & lungs", k=["hr", "sys", "dia", "spo2", "resp"], h="Fluid shifts, altered gravity, closed air", y="Fluids move toward the head and the heart deconditions. Cabin CO2 can raise breathing rate."),
 "gut": dict(n="Metabolism & nutrition", k=["glucose"], h="Limited food system, stress, low activity", y="Insulin sensitivity and appetite can change; poor nutrition worsens bone, immune and mood problems."),
 "arms": dict(n="Immune & thermal", k=["temp"], h="Space radiation and stress", y="Immune cells behave differently in flight; temperature is a quick check."),
 "legs": dict(n="Bones & muscle", k=["ex"], h="Reduced gravity loading", y="Weight-bearing bone density can fall roughly 1% per month without loading."),
}
ENVS = {"iss": ["Space station (LEO)", "~0 s", "Near real-time contact with flight surgeons."], "transit": ["Deep-space transit", "up to 22 min", "Delayed comms: you are first responder. Higher radiation."], "moon": ["Lunar base", "~1.3 s", "1/6 g and abrasive dust: watch eyes, lungs, joints."], "rover": ["Rover / EVA", "varies", "Suit heat and dehydration: log temperature after every EVA."]}
TASKS = [("Log vitals (auto when you save an entry)", 10), ("30+ min resistive exercise", 5), ("Hydrate (2 L)", 5), ("Check habitat air and filters", 5), ("Crew or family check-in", 5)]
HAZARDS = [("Space radiation", "DNA damage, immune and cardiovascular changes", "Shielding, dosimeters, diet. App tracks temperature and heart indicators."), ("Isolation & confinement", "Sleep disruption, low mood", "Sleep hygiene, crew check-ins. App tracks sleep and mood."), ("Distance from Earth", "Delayed medical help", "Self-assessment and clear actions. App flags when to call the surgeon."), ("Altered gravity", "Bone and muscle loss, fluid shifts", "2+ h/day exercise. App tracks exercise, HR and BP."), ("Hostile closed environment", "CO2, noise, microbes, heat", "Air monitoring. App tracks SpO2, breathing rate and temperature.")]
LEVELS = ["Cadet", "Crew member", "Flight engineer", "Mission specialist", "Commander"]
REMINDERS = [dict(n="Fasting blood sugar", t="07:30", on=False), dict(n="Morning vitals: HR, BP, temp, SpO2", t="08:00", on=True), dict(n="Exercise session", t="17:00", on=True), dict(n="Sleep and mood check-in", t="21:00", on=True)]

def status(k, v):
    i = I[k]
    return 2 if v < i["a"][0] or v > i["a"][1] else 1 if v < i["w"][0] or v > i["w"][1] else 0

def drift(es, k):
    if len(es) < 5: return False
    prev = sum(e[k] for e in es[-5:-1]) / 4
    return (es[-1][k] - prev) * I[k]["bad"] >= I[k]["t"]

def seed():
    return [dict(day=d, hr=63 + (d * 7) % 5 - 2 + 2 * max(0, d - 9), sys=117 + (d * 7) % 5 - 2 + max(0, d - 8), dia=76 + (d * 7) % 5 - 2, spo2=98 - (d > 11), resp=14 + (d > 10), glucose=92 + 2 * ((d * 7) % 5 - 2) + 10 * (d > 11), temp=round(36.6 + ((d * 7) % 5 - 2) * .05, 2), sleep=round(7.5 - (.25 * (d - 7) if d > 7 else 0), 1), mood=3 if d > 11 else 4, ex=45 - 5 * max(0, d - 9)) for d in range(1, 15)]

def load():
    if DB.exists(): return json.loads(DB.read_text())
    s = dict(entries=seed(), tasks={}, bank=0, env="iss", reminders=REMINDERS)
    save(s); return s

def save(s): DB.write_text(json.dumps(s))

def done_xp(s): return sum(TASKS[int(i)][1] for i, v in s["tasks"].items() if v and int(i) > 0)

def view(s):
    es = s["entries"]; last = es[-1]
    items = {k: dict(v=last[k], s=status(k, last[k]), drift=drift(es, k)) for k in K}
    al = sum(x["s"] == 2 for x in items.values()); wa = sum(x["s"] == 1 for x in items.values())
    ins = []
    for k, x in items.items():
        i = I[k]
        if x["s"]: ins.append(dict(k=k, level=x["s"], text=f'{i["n"]} {x["v"]} {i["u"]}: {i["g"][x["s"] - 1]}'))
        elif x["drift"]: ins.append(dict(k=k, level=1, text=f'{i["n"]} is drifting the wrong way. {i["g"][0]}'))
    healthy = sum(all(status(k, e[k]) == 0 for k in K) for e in es)
    xp = len(es) * 10 + healthy * 5 + s["bank"] + done_xp(s)  # banked XP survives "new day"
    streak = 1
    for j in range(len(es) - 1, 0, -1):
        if es[j]["day"] - es[j - 1]["day"] != 1: break
        streak += 1
    return dict(entries=[{**e, "_s": {k: status(k, e[k]) for k in K}} for e in es], tasks=s["tasks"], env=s["env"], reminders=s["reminders"],
        summary=dict(items=items, alerts=al, readiness=max(0, 100 - 18 * al - 7 * wa - 3 * sum(x["drift"] for x in items.values())), insights=ins),
        progress=dict(xp=xp, level=LEVELS[min(xp // 150, 4)], into=xp % 150, streak=streak))

class Entry(BaseModel):
    day: int; hr: float; sys: float; dia: float; spo2: float; resp: float; glucose: float; temp: float; sleep: float; mood: float; ex: float
class Task(BaseModel): done: bool

app = FastAPI(title="VitalOrbit")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/config")
def config(): return dict(I=I, K=K, regions=REGIONS, envs=ENVS, tasks=[dict(n=n, xp=x) for n, x in TASKS], hazards=HAZARDS)
@app.get("/api/state")
def state(): return view(load())
@app.post("/api/entries")
def add_entry(e: Entry):
    s = load(); s["entries"] = sorted([x for x in s["entries"] if x["day"] != e.day] + [e.model_dump()], key=lambda x: x["day"])
    s["tasks"]["0"] = True; save(s); return view(s)
@app.post("/api/tasks/{i}")
def task(i: int, t: Task):
    s = load(); s["tasks"][str(i)] = t.done; save(s); return view(s)
@app.post("/api/new-day")
def new_day():
    s = load(); s["bank"] += done_xp(s); s["tasks"] = {}; save(s); return view(s)
@app.put("/api/env/{env}")
def set_env(env: str):
    s = load(); s["env"] = env if env in ENVS else s["env"]; save(s); return view(s)
@app.put("/api/reminders")
def set_rem(r: list[dict]):
    s = load(); s["reminders"] = r; save(s); return view(s)
@app.get("/api/report", response_class=PlainTextResponse)
def report():
    s = load(); v = view(s); e = s["entries"][-1]; env = ENVS[s["env"]]; d = s["entries"][-7:]
    cur = "\n".join(f'- {I[k]["n"]}: {e[k]} {I[k]["u"]} [{["Nominal", "Watch", "Action"][x["s"]]}]{" (drifting)" if x["drift"] else ""}' for k, x in v["summary"]["items"].items())
    fl = "\n".join("- " + i["text"] for i in v["summary"]["insights"]) or "None"
    rows = "\n".join(",".join(str(x[c]) for c in ["day"] + K) for x in d)
    return f'VITALORBIT HEALTH SUMMARY FOR FLIGHT SURGEON\nMission day {e["day"]} | {env[0]} | Signal delay: {env[1]}\n\nCURRENT STATUS\n{cur}\n\nFLAGGED ITEMS\n{fl}\n\nLAST {len(d)} DAYS\nday,{",".join(K)}\n{rows}\n\nSelf-reported by the crew member. Not diagnostic.'
@app.get("/api/export.csv", response_class=PlainTextResponse)
def export_csv():
    es = load()["entries"]; return "day," + ",".join(K) + "\n" + "\n".join(",".join(str(x[c]) for c in ["day"] + K) for x in es)
