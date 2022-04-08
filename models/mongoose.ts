import Level from './db/level';
import LevelSchema from './schemas/levelSchema';
import Pack from './db/pack';
import PackSchema from './schemas/packSchema';
import Stat from './db/stat';
import StatSchema from './schemas/statSchema';
import User from './db/user';
import UserSchema from './schemas/userSchema';
import mongoose from 'mongoose';

// NB: need to initialize some models before they are referenced by other models
// (eg User before Pack since Pack has a User ref)
export const UserModel = mongoose.models.User || mongoose.model<User>('User', UserSchema);
export const PackModel = mongoose.models.Pack || mongoose.model<Pack>('Pack', PackSchema);
export const LevelModel = mongoose.models.Level || mongoose.model<Level>('Level', LevelSchema);
export const StatModel = mongoose.models.Stat || mongoose.model<Stat>('Stat', StatSchema);
