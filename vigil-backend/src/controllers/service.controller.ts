import { NextFunction, Request, Response } from 'express';
import { ServiceModel } from '../models/Service.js';
import { AppError } from '../types/index.js';
import { PingModel } from '../models/Ping.js';
import { checkService } from '../services/ping.service.js';

export async function createServiceCotroller(req: Request, res: Response, next: NextFunction) {
  const { name, url } = req.body;
  const service = await ServiceModel.create({
    workspaceId: req.auth!.workspaceId,
    name,
    url,
  });
  res.status(201).json(service);
}

export async function listServiceController(req: Request, res: Response, next: NextFunction) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [services, total] = await Promise.all([
    ServiceModel.find({ workspaceId: req.auth!.workspaceId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ServiceModel.countDocuments({ workspaceId: req.auth!.workspaceId }),
  ]);

  res.status(200).json({
    services,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getServiceController(req: Request, res: Response, next: NextFunction) {
  const service = await ServiceModel.findOne({
    _id: req.params.id,
    workspaceId: req.auth!.workspaceId,
  });
  if (!service) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }
  const pings = await PingModel.find({ serviceId: service._id })
    .sort({ checkedAt: -1 })
    .limit(20)
    .lean();

  res.status(200).json({ service, pings });
}

export async function updateServiceController(req: Request, res: Response, next: NextFunction) {
  const service = await ServiceModel.findOneAndUpdate(
    { _id: req.params.id, workspaceId: req.auth!.workspaceId },
    { $set: req.body },
    { new: true, runValidators: true },
  );

  if (!service) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }

  res.status(200).json(service);
}

export async function deleteServiceController(req: Request, res: Response, next: NextFunction) {
  const service = await ServiceModel.findOneAndDelete({
    _id: req.params.id,
    workspaceId: req.auth!.workspaceId,
  });
  if (!service) {
    throw new AppError('Service not found', 404, 'SERVICE_NOT_FOUND');
  }
  await PingModel.deleteMany({ serviceId: service._id });
  res.status(200).json({ message: 'Service deleted' });
}

export async function checkServiceController(req: Request, res: Response): Promise<void> {
  const result = await checkService(req.params.id! as string, req.auth!.workspaceId);
  res.status(200).json(result);
}
