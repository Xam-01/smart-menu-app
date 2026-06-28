/**
 * @copyright 2026 MK-TS-04
 * @project SmartMenu BE
 * @license Apache-2.0
 */

import { Router, Request, Response } from 'express';
import healthRouter from './health.router';
import authRouter from './auth.router';
import sessionRouter from './session.router';
import restaurantRouter from './restaurant.router';
import menuRouter from './menu.router';
import orderRouter from './order.router';
import publicRouter from './public.router';

const v1Router: Router = Router();

v1Router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'API is live',
    status: 'ok',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    server: 'Express + Node.js',
    docs: 'https://docs.smartmenu-api.mk-ts-04.com',
    timestamp: new Date().toISOString(),
  });
});

v1Router.use('/health', healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/sessions', sessionRouter);
v1Router.use('/restaurants', restaurantRouter);
v1Router.use('/menus', menuRouter);
v1Router.use('/orders', orderRouter);
v1Router.use('/public', publicRouter);

export default v1Router;
