import type { NextApiRequest, NextApiResponse } from 'next';
import User from '../../../models/db/user';
import { UserModel } from '../../../models/mongoose';
import bcrypt from 'bcrypt';
import dbConnect from '../../../lib/dbConnect';
import getTokenCookie from '../../../lib/getTokenCookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  await dbConnect();

  const { name, password } = req.body;
  const user = await UserModel.findOne<User>({ name });

  if (!user || user.password === undefined) {
    return res.status(401).json({
      error: 'Incorrect email or password',
    });
  }

  if (!await bcrypt.compare(password, user.password)) {
    return res.status(401).json({
      error: 'Incorrect email or password',
    });
  }

  res.setHeader('Set-Cookie', getTokenCookie(user._id.toString()))
    .status(200).json({ success: true });
}