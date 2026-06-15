// Explicaciones educativas de cada indicador macro (popover "?").
// Estructura detallada: definición, cómo interpretarlo, lecturas
// positiva/neutral/negativa y por qué importa. Centralizado para reutilizar en
// MacroDataCard, tasas, FX, commodities, cripto y calendario.

export interface MacroHelp {
  title: string;
  definition: string;
  interpretation: string;
  positiveReading: string;
  neutralReading: string;
  negativeReading: string;
  whyItMatters: string;
  sourceNotes?: string;
}

export const MACRO_INDICATOR_HELP: Record<string, MacroHelp> = {
  fedFundsRate: {
    title: "Tasa de Fondos Federales",
    definition:
      "Tasa de interés objetivo a un día que fija la Reserva Federal para los préstamos entre bancos; es uno de los principales referentes de la política monetaria de EE.UU.",
    interpretation:
      "Tasas más altas suelen indicar política monetaria más restrictiva; tasas más bajas, política más laxa. El efecto depende de la inflación, el crecimiento y las expectativas del mercado.",
    positiveReading:
      "Tasas estables o a la baja pueden apoyar a las acciones, sobre todo de crecimiento, si la inflación está controlada.",
    neutralReading:
      "Tasas estables con inflación y crecimiento equilibrados sugieren una Fed en compás de espera.",
    negativeReading:
      "Tasas al alza o persistentemente altas pueden presionar valuaciones, encarecer el crédito y reducir el apetito por el riesgo.",
    whyItMatters:
      "Las tasas afectan las tasas de descuento, el costo de financiamiento corporativo, el crédito al consumo, la vivienda, la rentabilidad bancaria y la valuación de las acciones.",
    sourceNotes: "Fuente: FRED (FEDFUNDS).",
  },
  cpi: {
    title: "Inflación CPI",
    definition:
      "El Índice de Precios al Consumidor (CPI) mide el cambio promedio de los precios que pagan los consumidores por una canasta de bienes y servicios; es la principal medida de la inflación de precios al consumidor.",
    interpretation:
      "Un CPI más alto significa que los precios suben más rápido; uno más bajo indica que la presión inflacionaria se modera.",
    positiveReading:
      "Un CPI a la baja puede apoyar las expectativas de menores tasas y favorecer a los activos de riesgo.",
    neutralReading:
      "Un CPI estable cerca del objetivo de la Fed sugiere que la inflación está controlada.",
    negativeReading:
      "Un CPI al alza puede obligar a la Fed a mantener o subir tasas, lo que suele presionar a las acciones.",
    whyItMatters:
      "La inflación afecta las tasas de interés, el poder de compra, los márgenes, los rendimientos de los bonos y los múltiplos de valuación.",
    sourceNotes: "Fuente: FRED (interanual, CPIAUCSL).",
  },
  pce: {
    title: "Inflación PCE",
    definition:
      "El índice de precios del Gasto en Consumo Personal (PCE) mide la inflación según los patrones de gasto de los consumidores; es la medida de inflación PREFERIDA de la Reserva Federal.",
    interpretation:
      "Un PCE a la baja sugiere que la inflación cede; un PCE al alza sugiere que la presión inflacionaria sigue persistente.",
    positiveReading: "Un PCE más bajo puede apoyar una postura más suave de la Fed.",
    neutralReading: "Un PCE cerca del objetivo sugiere estabilidad de precios.",
    negativeReading:
      "Un PCE alto o al alza puede mantener las tasas restrictivas por más tiempo.",
    whyItMatters:
      "Como la Fed prioriza el PCE, este indicador puede influir fuertemente en las expectativas de tasas y en la valuación del mercado.",
    sourceNotes: "Fuente: FRED (interanual, PCEPI).",
  },
  unemploymentRate: {
    title: "Tasa de desempleo",
    definition:
      "Mide el porcentaje de la fuerza laboral que busca trabajo activamente pero no lo tiene.",
    interpretation:
      "Una tasa muy baja suele indicar un mercado laboral fuerte; una tasa en aumento puede señalar debilidad económica.",
    positiveReading:
      "Un desempleo bajo y estable puede apoyar el consumo y los ingresos de las empresas.",
    neutralReading:
      "Un desempleo estable sugiere que el mercado laboral no se está deteriorando.",
    negativeReading:
      "Un desempleo que sube rápido puede señalar riesgo de recesión y menor demanda.",
    whyItMatters:
      "El empleo afecta el gasto del consumidor, la inflación salarial, la política de la Fed, las expectativas de ganancias y el riesgo de recesión.",
    sourceNotes: "Fuente: FRED (UNRATE).",
  },
  nonFarmPayrolls: {
    title: "Nóminas no agrícolas (NFP)",
    definition:
      "Miden el cambio mensual en el número de trabajadores asalariados de EE.UU., excluyendo el campo, el servicio doméstico y algunas categorías del gobierno.",
    interpretation:
      "Una fuerte creación de empleo señala fortaleza económica; un crecimiento débil o negativo puede señalar demanda en desaceleración.",
    positiveReading:
      "Una creación de empleo saludable apoya el ingreso, el gasto y el crecimiento económico.",
    neutralReading:
      "Un crecimiento moderado del empleo sugiere condiciones económicas estables.",
    negativeReading:
      "Un crecimiento muy débil del empleo puede aumentar la preocupación por una recesión.",
    whyItMatters:
      "Las NFP son uno de los datos laborales que más mueven al mercado porque influyen en las expectativas de la Fed, los rendimientos de los bonos y el ánimo de la renta variable.",
    sourceNotes: "Fuente: FRED (cambio mensual, PAYEMS).",
  },
  gdpGrowth: {
    title: "Crecimiento del PIB",
    definition:
      "El Producto Interno Bruto mide el valor total de los bienes y servicios producidos en la economía; el PIB real ajusta por inflación.",
    interpretation:
      "Un crecimiento positivo sugiere expansión económica; un crecimiento negativo sugiere contracción.",
    positiveReading:
      "Un crecimiento real saludable apoya las ganancias corporativas y el apetito por el riesgo.",
    neutralReading:
      "Un crecimiento moderado sugiere estabilidad sin sobrecalentamiento.",
    negativeReading:
      "Un crecimiento negativo o que se frena bruscamente puede aumentar el riesgo de recesión.",
    whyItMatters:
      "El PIB ofrece la foto más amplia de la actividad económica y ayuda a juzgar el entorno de ganancias y demanda.",
    sourceNotes: "Fuente: FRED (real, anualizado).",
  },
  industrialProduction: {
    title: "Producción industrial",
    definition:
      "La producción industrial mide la producción real de la manufactura, la minería y los servicios de electricidad y gas de EE.UU.",
    interpretation:
      "Una producción al alza sugiere mayor output físico y demanda industrial; a la baja sugiere actividad industrial más débil.",
    positiveReading:
      "Una producción que mejora puede apoyar a los sectores cíclicos, industriales, materiales y a la demanda de energía.",
    neutralReading: "Una producción estable sugiere actividad industrial constante.",
    negativeReading:
      "Una producción en caída puede advertir de menor demanda, manufactura más débil o presión recesiva.",
    whyItMatters:
      "Es un indicador útil de la economía real que puede confirmar o desafiar lo que descuenta el mercado de acciones.",
    sourceNotes: "Fuente: FRED (INDPRO).",
  },
  retailSales: {
    title: "Ventas minoristas",
    definition:
      "Miden las ventas de los comercios minoristas y de servicios de comida de EE.UU.; son un proxy clave del consumo.",
    interpretation:
      "Ventas al alza sugieren mayor demanda del consumidor; a la baja sugieren un consumo más débil.",
    positiveReading:
      "Ventas fuertes pueden apoyar el crecimiento económico y los ingresos de las empresas.",
    neutralReading:
      "Ventas estables sugieren que los consumidores siguen gastando a un ritmo normal.",
    negativeReading:
      "Ventas débiles pueden advertir de menor demanda, presión de márgenes o crecimiento más lento.",
    whyItMatters:
      "El consumo es una gran parte de la economía de EE.UU., así que las ventas minoristas afectan las expectativas de ganancias y el ánimo del mercado.",
    sourceNotes: "Fuente: FRED (RSAFS; mostrado en miles de millones).",
  },
  consumerConfidence: {
    title: "Confianza del consumidor",
    definition:
      "Mide qué tan optimistas o pesimistas están los consumidores sobre las condiciones económicas actuales y futuras.",
    interpretation:
      "Mayor confianza suele sugerir más disposición a gastar; menor confianza puede señalar cautela.",
    positiveReading:
      "Una confianza al alza puede apoyar el retail, el gasto discrecional, la vivienda y los servicios.",
    neutralReading:
      "Una confianza estable sugiere que el comportamiento del consumidor puede mantenerse.",
    negativeReading:
      "Una confianza en caída puede advertir de menor gasto y crecimiento más lento.",
    whyItMatters:
      "La psicología del consumidor afecta las decisiones de gasto, que fluyen hacia los ingresos y las ganancias.",
    sourceNotes: "Fuente: FRED (Universidad de Michigan, UMCSENT).",
  },
  treasury2Y: {
    title: "Tesoro 2 años",
    definition:
      "Rendimiento del bono del Tesoro de EE.UU. a 2 años, muy sensible a las expectativas de política de la Fed.",
    interpretation:
      "Sube cuando el mercado espera tasas más altas y baja cuando espera recortes.",
    positiveReading:
      "Un 2 años a la baja puede reflejar expectativas de política más laxa (apoyo a la renta variable).",
    neutralReading: "Un 2 años estable sugiere expectativas de tasas ancladas.",
    negativeReading:
      "Un 2 años al alza refleja expectativas de tasas más altas, que pueden presionar las valuaciones.",
    whyItMatters:
      "Es el tramo de la curva que mejor refleja la trayectoria esperada de la Fed.",
    sourceNotes: "Fuente: FRED (DGS2).",
  },
  treasury5Y: {
    title: "Tesoro 5 años",
    definition: "Rendimiento del bono del Tesoro de EE.UU. a 5 años (mediano plazo).",
    interpretation:
      "Refleja expectativas combinadas de tasas, inflación y crecimiento a mediano plazo.",
    positiveReading: "Estable o a la baja con inflación controlada suele ser constructivo.",
    neutralReading: "Movimientos laterales sugieren expectativas equilibradas.",
    negativeReading:
      "Subidas rápidas pueden endurecer las condiciones financieras y presionar la valuación.",
    whyItMatters:
      "Sirve de puente entre las expectativas de política de corto plazo y las de largo plazo.",
    sourceNotes: "Fuente: Yahoo Finance (^FVX).",
  },
  treasury10Y: {
    title: "Tesoro 10 años",
    definition:
      "Rendimiento del bono del Tesoro de EE.UU. a 10 años; referencia clave para la valuación, las hipotecas y las tasas de descuento.",
    interpretation:
      "Sube cuando aumentan las expectativas de crecimiento/inflación o la oferta de bonos; baja en escenarios de aversión al riesgo o menor inflación.",
    positiveReading:
      "Un 10 años estable o moderado apoya la valuación de las acciones de crecimiento.",
    neutralReading: "Un 10 años en rango sugiere expectativas equilibradas.",
    negativeReading:
      "Subidas fuertes del 10 años presionan a las acciones de alto múltiplo y encarecen el crédito.",
    whyItMatters:
      "Es la tasa libre de riesgo de referencia que se usa para descontar los flujos futuros de las empresas.",
    sourceNotes: "Fuente: Yahoo Finance (^TNX).",
  },
  treasury30Y: {
    title: "Tesoro 30 años",
    definition:
      "Rendimiento del bono del Tesoro de EE.UU. a 30 años (muy largo plazo).",
    interpretation:
      "Refleja las expectativas de inflación y crecimiento de muy largo plazo y la demanda de duración.",
    positiveReading: "Estable con inflación controlada suele ser saludable.",
    neutralReading: "Movimientos laterales sugieren expectativas ancladas.",
    negativeReading:
      "Subidas marcadas pueden señalar preocupación por inflación o por la oferta de deuda.",
    whyItMatters:
      "Afecta las hipotecas de largo plazo, los seguros, las pensiones y la valuación de activos de larga duración.",
    sourceNotes: "Fuente: Yahoo Finance (^TYX).",
  },
  yieldCurve10Y2Y: {
    title: "Curva 10A - 2A",
    definition:
      "Mide la diferencia entre el rendimiento del Tesoro a 10 años y el de 2 años.",
    interpretation:
      "Un spread positivo es una curva normal; un spread negativo significa que la curva está invertida.",
    positiveReading:
      "Una curva normal o que se empina puede sugerir expectativas de crecimiento más saludables.",
    neutralReading:
      "Una curva plana sugiere incertidumbre sobre el crecimiento y las tasas.",
    negativeReading:
      "Una curva invertida puede señalar preocupación por el crecimiento futuro y, históricamente, se asocia con riesgo de recesión.",
    whyItMatters:
      "La curva afecta a los bancos, las condiciones de crédito, las expectativas de recesión y el apetito por el riesgo.",
    sourceNotes: "Fuente: FRED/Yahoo.",
  },
  vix: {
    title: "VIX",
    definition:
      "El VIX es un índice de volatilidad implícita basado en las opciones del S&P 500; a menudo se le llama el 'índice del miedo' del mercado.",
    interpretation:
      "Un VIX más alto significa que los inversionistas esperan más volatilidad; uno más bajo, condiciones más calmadas.",
    positiveReading: "Un VIX moderado o a la baja puede apoyar el apetito por el riesgo.",
    neutralReading: "Un VIX estable sugiere que no hay un cambio importante en el estrés del mercado.",
    negativeReading:
      "Un VIX al alza o muy elevado puede señalar miedo, incertidumbre o estrés de mercado.",
    whyItMatters:
      "La volatilidad afecta el tamaño de las posiciones, la gestión de riesgo, el precio de las opciones y la fiabilidad de los setups técnicos.",
    sourceNotes: "Fuente: Yahoo Finance (^VIX).",
  },
  fx: {
    title: "Divisas (FX)",
    definition:
      "Un par de divisas muestra el tipo de cambio entre dos monedas (p. ej. EUR/USD, USD/MXN).",
    interpretation:
      "Cuando el par sube, la primera moneda se fortalece frente a la segunda; cuando baja, se debilita.",
    positiveReading:
      "Depende del activo: para multinacionales de EE.UU., un dólar más fuerte puede presionar la traducción de ingresos del exterior; para importadores, puede reducir costos.",
    neutralReading: "Niveles de cambio estables sugieren poca presión cambiaria.",
    negativeReading:
      "Movimientos bruscos pueden crear estrés en ganancias, inflación o mercados emergentes.",
    whyItMatters:
      "Las divisas afectan las ganancias de las multinacionales, las materias primas, la inflación, los flujos de inversión y el apetito por el riesgo.",
    sourceNotes: "Fuente: Yahoo Finance.",
  },
  commodities: {
    title: "Materias primas",
    definition:
      "Los precios de las materias primas reflejan el mercado de insumos como energía, metales y agrícolas.",
    interpretation:
      "Materias primas al alza pueden señalar mayor demanda o restricciones de oferta; a la baja, menor demanda o menor presión inflacionaria.",
    positiveReading:
      "Una fortaleza moderada puede apoyar a los productores y señalar demanda.",
    neutralReading: "Precios estables sugieren oferta y demanda equilibradas.",
    negativeReading:
      "Picos fuertes de energía aumentan la inflación y presionan al consumidor; caídas bruscas pueden advertir de debilidad en la demanda.",
    whyItMatters:
      "Las materias primas afectan la inflación, los márgenes, el liderazgo sectorial y el riesgo macro.",
    sourceNotes: "Fuente: Yahoo Finance.",
  },
  crypto: {
    title: "Cripto",
    definition:
      "Las criptomonedas son activos digitales que suelen operar como activos de riesgo de alta volatilidad.",
    interpretation:
      "Cripto al alza puede señalar apetito por el riesgo y liquidez; a la baja, comportamiento risk-off o estrés en activos especulativos.",
    positiveReading:
      "La fortaleza de las cripto puede sugerir demanda especulativa y apetito por el riesgo.",
    neutralReading: "Un movimiento lateral aporta poca señal.",
    negativeReading:
      "Caídas bruscas pueden reflejar aversión al riesgo, estrés de liquidez o desapalancamiento especulativo.",
    whyItMatters:
      "Las cripto pueden actuar como proxy de sentimiento y liquidez, sobre todo en entornos especulativos.",
    sourceNotes: "Fuente: Yahoo Finance.",
  },
  economicCalendar: {
    title: "Calendario económico",
    definition:
      "Lista las próximas publicaciones de datos macro relevantes (CPI, empleo, Fed, PIB, etc.) con su fecha de publicación.",
    interpretation:
      "Los eventos de alto impacto pueden mover el mercado el día de su publicación, según la sorpresa frente a lo esperado.",
    positiveReading:
      "Saber qué viene ayuda a anticipar la volatilidad y a no quedar sorprendido por una publicación clave.",
    neutralReading:
      "Periodos sin eventos de alto impacto suelen tener menos catalizadores macro.",
    negativeReading:
      "Una concentración de datos de alto impacto puede elevar el riesgo de volatilidad a corto plazo.",
    whyItMatters:
      "El calendario ayuda a planear la gestión de riesgo alrededor de eventos que pueden mover índices, tasas y divisas.",
    sourceNotes:
      "Fuente: calendario de releases de FRED; las fechas las publican las fuentes de cada dato y pueden no coincidir con el momento exacto de disponibilidad.",
  },
};
