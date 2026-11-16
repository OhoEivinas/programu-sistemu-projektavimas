# Klinikų darbuotojų pamainų sistema

Programų sistemų projektavimo kursinio darbo II etapas. Šiame etape įgyvendinau pirmoje dalyje suplanuotą pamainų skirstymo modulį. Programa pagal darbuotojų duomenis sudaro grafiką ir parodo, kodėl konkreti pamaina buvo paskirta arba nepaskirta.

## Kas veikia

- Pamainos skirstomos pagal darbuotojų prieinamumą, savaitės valandų limitą ir bent 12 val. poilsio taisyklę.
- Darbuotojui negali būti paskirtos dvi pamainos tą pačią dieną.
- Iš tinkamų kandidatų parenkamas didžiausią balą surinkęs darbuotojas. Balas priklauso nuo jo pageidavimų ir jau turimo darbo krūvio; lygiųjų atvejis taip pat apibrėžtas.
- Jei nėra tinkamo darbuotojo, rodoma konflikto priežastis.
- Galima pakeisti darbuotojų pamainų prioritetus ir sugeneruoti grafiką iš naujo.
- Yra dvi atskiros demonstracinės klinikos. Vienos klinikos duomenų negalima skaityti ar keisti naudojant kitos klinikos kontekstą.

## Kaip paleisti

Reikia **Node.js 22.16 arba naujesnės versijos** ir kartu įdiegto npm. Projektą patikrinau su Node.js 26.13.1 ir npm 11.20.0. Papildomų bibliotekų ar duomenų bazės diegti nereikia.

Atidarykite terminalą aplanke, kuriame yra `package.json`, ir paleiskite:

```bash
npm start
```

Naršyklėje atidarykite **http://localhost:3000**.

Windows sistemoje galima tiesiog paleisti ir `PALEISTI_WINDOWS.bat`. Programą sustabdysite terminale paspaudę `Ctrl+C`.

## Automatiniai testai

Kitame terminale, tame pačiame projekto aplanke, paleiskite:

```bash
npm test
```

Šiuo metu yra **13 testų**. Jie tikrina įprastą pamainos priskyrimą, konfliktus, netinkamą įvestį, lygiąsias, skirtingų klinikų duomenų izoliavimą ir visą grafiko generavimą per HTTP. Patikrinus visi 13 testų praėjo.

## Pavyzdiniai duomenys ir demonstravimas

Duomenys fiktyvūs, o naudojamos datos – **2026 m. spalio 12–14 d.**

- **Vilniaus klinika (A):** 3 darbuotojai ir 5 pamainos.
- **Kauno klinika (B):** 2 darbuotojai ir 2 pamainos.

Demonstravimo eiga:

1. Paleisti programą ir pasirinkti Vilniaus kliniką.
2. Paspausti **„Generuoti grafiką“**. Turėtų būti paskirtos **4 pamainos**, o **1** likti su konfliktu.
3. Išskleisti **S4 konflikto priežastis** ir parodyti, kodėl darbuotojai buvo atmesti.
4. Pakeisti vieno darbuotojo pamainų prioritetus, išsaugoti ir sugeneruoti grafiką dar kartą.
5. Paspausti **„Patikrinti izoliaciją“**. Bandymai iš vienos klinikos pasiekti kitos darbuotojo įrašą turi grąžinti **HTTP 404**.
6. Perjungti į Kauno kliniką ir parodyti jos atskirus duomenis.
7. Terminale paleisti `npm test` ir parodyti rezultatus.

## Kodo struktūra

- `src/engine.ts` – pamainų parinkimo algoritmas (`ShiftOptimizationEngine`).
- `src/rules.ts` – darbuotojų tinkamumo ir balo skaičiavimo taisyklės (T1–T6).
- `src/repository.ts` – klinikų duomenų saugojimas ir atskyrimas.
- `src/api.ts` ir `src/server.ts` – užklausų apdorojimas ir serveris.
- `src/demoData.ts` – abiejų klinikų pavyzdiniai duomenys.
- `public/` – paprasta naršyklės sąsaja.
- `tests/` – automatiniai testai.

II etapui pasirinktas paprastas Node.js ir TypeScript prototipas be atskiros duomenų bazės. Kol serveris veikia, duomenys laikomi atmintyje; perkrovus serverį jie grįžta į pradinę būseną. Prisijungimo ir rolių sistemos šiame etape nėra. Klinikos atskiriamos demonstraciniais raktais, todėl tai dar nėra realiam naudojimui skirta autentifikacija.

Kuriant prototipą naudotasi ChatGPT pagalba. Pamainų paskirstymo algoritmas pats AI nenaudoja – jo rezultatai apskaičiuojami pagal apibrėžtas taisykles.
