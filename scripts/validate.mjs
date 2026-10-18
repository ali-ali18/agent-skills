// Validador mínimo de JSON Schema (o subconjunto usado em schema/*.json).

function typeOf(value) {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

export function validate(schema, value, path = "$") {
	const errors = [];
	const types = schema.type === undefined ? null : Array.isArray(schema.type) ? schema.type : [schema.type];
	const actual = typeOf(value);
	if (types && !types.includes(actual)) {
		return [`${path}: esperado ${types.join("|")}, veio ${actual}`];
	}
	if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: valor fora de ${JSON.stringify(schema.enum)}`);
	if (actual === "string") {
		if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: curto demais`);
		if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: passa de ${schema.maxLength} caracteres`);
		if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: formato inválido`);
	}
	if (actual === "array") {
		if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: itens de menos`);
		if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: itens demais (máx. ${schema.maxItems})`);
		if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path}: itens repetidos`);
		if (schema.items) value.forEach((item, index) => errors.push(...validate(schema.items, item, `${path}[${index}]`)));
	}
	if (actual === "object") {
		for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}: falta o campo ${key}`);
		const props = schema.properties ?? {};
		for (const [key, item] of Object.entries(value)) {
			if (props[key]) errors.push(...validate(props[key], item, `${path}.${key}`));
			else if (schema.additionalProperties === false) errors.push(`${path}: campo desconhecido ${key}`);
		}
	}
	return errors;
}
