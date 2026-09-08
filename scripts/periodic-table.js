const elementIdentities = [
	["H", "Hydrogen"],
	["He", "Helium"],
	["Li", "Lithium"],
	["Be", "Beryllium"],
	["B", "Boron"],
	["C", "Carbon"],
	["N", "Nitrogen"],
	["O", "Oxygen"],
	["F", "Fluorine"],
	["Ne", "Neon"],
	["Na", "Sodium"],
	["Mg", "Magnesium"],
	["Al", "Aluminium"],
	["Si", "Silicon"],
	["P", "Phosphorus"],
	["S", "Sulfur"],
	["Cl", "Chlorine"],
	["Ar", "Argon"],
	["K", "Potassium"],
	["Ca", "Calcium"],
	["Sc", "Scandium"],
	["Ti", "Titanium"],
	["V", "Vanadium"],
	["Cr", "Chromium"],
	["Mn", "Manganese"],
	["Fe", "Iron"],
	["Co", "Cobalt"],
	["Ni", "Nickel"],
	["Cu", "Copper"],
	["Zn", "Zinc"],
	["Ga", "Gallium"],
	["Ge", "Germanium"],
	["As", "Arsenic"],
	["Se", "Selenium"],
	["Br", "Bromine"],
	["Kr", "Krypton"],
	["Rb", "Rubidium"],
	["Sr", "Strontium"],
	["Y", "Yttrium"],
	["Zr", "Zirconium"],
	["Nb", "Niobium"],
	["Mo", "Molybdenum"],
	["Tc", "Technetium"],
	["Ru", "Ruthenium"],
	["Rh", "Rhodium"],
	["Pd", "Palladium"],
	["Ag", "Silver"],
	["Cd", "Cadmium"],
	["In", "Indium"],
	["Sn", "Tin"],
	["Sb", "Antimony"],
	["Te", "Tellurium"],
	["I", "Iodine"],
	["Xe", "Xenon"],
	["Cs", "Caesium"],
	["Ba", "Barium"],
	["La", "Lanthanum"],
	["Ce", "Cerium"],
	["Pr", "Praseodymium"],
	["Nd", "Neodymium"],
	["Pm", "Promethium"],
	["Sm", "Samarium"],
	["Eu", "Europium"],
	["Gd", "Gadolinium"],
	["Tb", "Terbium"],
	["Dy", "Dysprosium"],
	["Ho", "Holmium"],
	["Er", "Erbium"],
	["Tm", "Thulium"],
	["Yb", "Ytterbium"],
	["Lu", "Lutetium"],
	["Hf", "Hafnium"],
	["Ta", "Tantalum"],
	["W", "Tungsten"],
	["Re", "Rhenium"],
	["Os", "Osmium"],
	["Ir", "Iridium"],
	["Pt", "Platinum"],
	["Au", "Gold"],
	["Hg", "Mercury"],
	["Tl", "Thallium"],
	["Pb", "Lead"],
	["Bi", "Bismuth"],
	["Po", "Polonium"],
	["At", "Astatine"],
	["Rn", "Radon"],
	["Fr", "Francium"],
	["Ra", "Radium"],
	["Ac", "Actinium"],
	["Th", "Thorium"],
	["Pa", "Protactinium"],
	["U", "Uranium"],
	["Np", "Neptunium"],
	["Pu", "Plutonium"],
	["Am", "Americium"],
	["Cm", "Curium"],
	["Bk", "Berkelium"],
	["Cf", "Californium"],
	["Es", "Einsteinium"],
	["Fm", "Fermium"],
	["Md", "Mendelevium"],
	["No", "Nobelium"],
	["Lr", "Lawrencium"],
	["Rf", "Rutherfordium"],
	["Db", "Dubnium"],
	["Sg", "Seaborgium"],
	["Bh", "Bohrium"],
	["Hs", "Hassium"],
	["Mt", "Meitnerium"],
	["Ds", "Darmstadtium"],
	["Rg", "Roentgenium"],
	["Cn", "Copernicium"],
	["Nh", "Nihonium"],
	["Fl", "Flerovium"],
	["Mc", "Moscovium"],
	["Lv", "Livermorium"],
	["Ts", "Tennessine"],
	["Og", "Oganesson"]
];

/**
 * Gets the grid position for an element's atomic number.
 * @param {number} atomicNumber
 * @returns {{ column: number, row: number }}
 */
function getElementPosition(atomicNumber) {
	if (atomicNumber === 1) {
		return { column: 1, row: 1 };
	}

	if (atomicNumber === 2) {
		return { column: 18, row: 1 };
	}

	if (atomicNumber >= 3 && atomicNumber <= 4) {
		return { column: atomicNumber - 2, row: 2 };
	}

	if (atomicNumber >= 5 && atomicNumber <= 10) {
		return { column: atomicNumber + 8, row: 2 };
	}

	if (atomicNumber >= 11 && atomicNumber <= 12) {
		return { column: atomicNumber - 10, row: 3 };
	}

	if (atomicNumber >= 13 && atomicNumber <= 18) {
		return { column: atomicNumber, row: 3 };
	}

	if (atomicNumber >= 19 && atomicNumber <= 36) {
		return { column: atomicNumber - 18, row: 4 };
	}

	if (atomicNumber >= 37 && atomicNumber <= 54) {
		return { column: atomicNumber - 36, row: 5 };
	}

	if (atomicNumber >= 55 && atomicNumber <= 57) {
		return { column: atomicNumber - 54, row: 6 };
	}

	if (atomicNumber >= 58 && atomicNumber <= 71) {
		return { column: atomicNumber - 54, row: 9 };
	}

	if (atomicNumber >= 72 && atomicNumber <= 86) {
		return { column: atomicNumber - 68, row: 6 };
	}

	if (atomicNumber >= 87 && atomicNumber <= 89) {
		return { column: atomicNumber - 86, row: 7 };
	}

	if (atomicNumber >= 90 && atomicNumber <= 103) {
		return { column: atomicNumber - 86, row: 10 };
	}

	return { column: atomicNumber - 100, row: 7 };
}

/**
 * Creates immutable element data in atomic-number order.
 * @returns {ReadonlyArray<object>}
 */
function createPeriodicTableElements() {
	const elements = [];

	for (let index = 0; index < elementIdentities.length; index += 1) {
		const atomicNumber = index + 1;
		const position = getElementPosition(atomicNumber);

		elements.push(Object.freeze({
			atomicNumber,
			symbol: elementIdentities[index][0],
			name: elementIdentities[index][1],
			column: position.column,
			row: position.row
		}));
	}

	return Object.freeze(elements);
}

export const periodicTableElements = createPeriodicTableElements();

/**
 * Substitutes atomic-number and symbol tokens in an element URL template.
 * @param {object} params
 * @param {object} params.element
 * @param {string} params.template
 * @returns {string}
 */
export function getPeriodicTableElementUrl({ element, template }) {
	return String(template)
		.replace(/\{z\}/gi, encodeURIComponent(element.atomicNumber))
		.replace(/\{symbol\}/gi, encodeURIComponent(element.symbol));
}
