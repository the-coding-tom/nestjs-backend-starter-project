import * as Joi from 'joi';

export function validateJoiSchema(
  schema: Joi.ObjectSchema | Joi.ArraySchema,
  data: any,
): string | null {
  const { error } = schema.validate(data, {
    errors: {
      wrap: { label: '' },
    },
    abortEarly: true,
  });
  return error ? error.details[0].message : null;
}
