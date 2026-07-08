# Mechanics of Spatial Vibration III: Simulation Sandbox

This repository contains the interactive geomechanical simulation sandbox for **"Mechanics of Spatial Vibration III: Cosmic Plate Tectonics and Wave Interference Topography based Prediction of Extreme Cosmic Phenomena"** (Version 6).

This computational sandbox is designed to physically and visually demonstrate the cosmological core concepts presented in the paper, utilizing standard web canvas technologies.

## 🌐 Online Access & Interactive Demo
You can run the simulation locally by simply double-clicking the **[index.html](index.html)** file in any web browser (no installation or local server required), or integrate the Next.js React component **`SimulationWidget_V3.tsx`** into your portfolio or research portal.

---

## 📺 Simulation Modes

### 1. Mode A: Cosmic Web Emergence (Wave Interference)
Demonstrates the speculative model of **Cosmic Plate Tectonics**, where the universe is fragmented into giant phase coherent domains (space plates).
* **Interference Topography:** Mismatched domain boundaries ($\Delta\theta \approx \pi$) undergo destructive interference, driving matter away via covariant drift velocity to form **Cosmic Voids**. Constructive boundaries ($\Delta\theta \approx 0$) amplify vibration energy, acting as gravitational attractors to form **Cosmic Web Filaments**.
* **Interactive Parameters:** Adjust Phase Discordance ($\Delta\theta$) and Baryon Gas Thermal Pressure ($\sigma$) to see the matter partition dynamics in real-time alongside a live matter density profile chart.

### 2. Mode B: Cosmic Quake & Gertsenshtein Converter
Demonstrates the tectonic slip-rupture mechanism of spatial domains and the subsequent emission of Fast Radio Bursts (FRBs).
* **Stress Accumulation:** A 3D-projected space grid deforms as two plates slide past each other, accumulating elastic shear stress ($S_{\mu\nu}$). Friction emits low-frequency (nHz) **Stochastic Background Gravitational Waves (SGWB)**.
* **Fault Rupture:** Upon exceeding critical threshold ($S_{\mathrm{crit}}$), the fault violently slips, releasing a GHz-band Gravitational Wave burst.
* **Gertsenshtein Conversion:** As the GW wavefront passes through a magnetized plasma column, it resonates and converts into high-energy electromagnetic shockwaves (golden **FRB photons**).
* **Charts:** Tracks real-time stress sawtooth profile and frequency spectrum power distribution (nHz vs GHz).

### 3. Mode C: POINTING Precursor Protocol
Demonstrates the **POINTING** (Phasic Observation & Interferometric Network for Tensor-field Induced Neural Gravitational-signals) early-warning system.
* **Pulsar Jitter Monitoring:** A 3D network of pulsars experiences timing jitter anomalies caused by precursor low-frequency waves.
* **Neural Network Decoding:** A visual neural network analyzer decodes timing deviations, computing the rupture probability ($P_{\mathrm{quake}}$).
* **Auto-Lock Alert:** When probability exceeds 85%, a red warning triggers, prying telescopes to target-lock the coordinate reticle. Shortly after, the targeted system experiences an FRB burst, showing successful prediction validation.

---

## 🛠️ File Structure
* **`index.html`**: Zero-dependency standalone HTML5 canvas simulation.
* **`SimulationWidget_V3.tsx`**: High-performance React TypeScript component for modern web frameworks (Next.js, Vite).
* **`CITATION.cff`**: Academic citation metadata in standard YAML format.
* **`LICENSE`**: MIT License.

---

## 📄 Academic Citation
If you use this simulation model or the ideas from the paper in your research, please cite the repository:
```bibtex
@software{yoo2026spatial3,
  author = {Yoo, Kwang Yong},
  title = {Mechanics of Spatial Vibration III: Cosmic Plate Tectonics and Wave Interference Topography Sandbox},
  url = {https://github.com/khanyong/spatial-vibration-series-3},
  version = {1.0.0},
  year = {2026}
}
```
