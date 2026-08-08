import { Router } from 'express';
import z from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  checkServiceController,
  createServiceCotroller,
  deleteServiceController,
  getServiceController,
  listServiceController,
  updateServiceController,
} from '../controllers/service.controller.js';

const router = Router();

const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.url(),
});

const updateServiceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.url().optional(),
});

router.use(requireAuth);

router.post('/', validate(createServiceSchema), asyncHandler(createServiceCotroller));
router.get('/', asyncHandler(listServiceController));
router.get('/:id', asyncHandler(getServiceController));
router.patch('/:id', validate(updateServiceSchema), asyncHandler(updateServiceController));
router.delete(':id', asyncHandler(deleteServiceController));
router.post('/:id/check', asyncHandler(checkServiceController));

export { router as servicesRouter };
