const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

// Représentation publique : jamais de hash, jamais de secret.
userSchema.set('toJSON', {
  transform: (_doc, ret) => ({ id: ret._id.toString(), email: ret.email }),
});

module.exports = model('User', userSchema);
