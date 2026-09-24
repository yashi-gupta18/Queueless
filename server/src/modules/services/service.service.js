import Branch from '../../models/branch.model.js';
import Counter from '../../models/counter.model.js';
import Service from '../../models/service.model.js';
import ApiError from '../../utils/apiError.js';

const ensureBranchExists = async (id) => {
  const branch = await Branch.exists({ _id: id });

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }
};

const ensureUniqueServiceName = async (branch, name, excludeId = null) => {
  const query = { branch, name };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const service = await Service.exists(query);

  if (service) {
    throw new ApiError(409, 'Service name already exists for this branch');
  }
};

export const createService = async (data) => {
  await ensureBranchExists(data.branch);
  await ensureUniqueServiceName(data.branch, data.name);
  return Service.create(data);
};

export const getServices = async () => {
  return Service.find().populate('branch', 'name city state').sort({ createdAt: -1 });
};

export const getServiceById = async (id) => {
  const service = await Service.findById(id).populate('branch', 'name city state');

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  return service;
};

export const updateService = async (id, data) => {
  const existingService = await Service.findById(id);

  if (!existingService) {
    throw new ApiError(404, 'Service not found');
  }

  const nextBranch = data.branch ?? existingService.branch;
  const nextName = data.name ?? existingService.name;

  if (data.branch) {
    await ensureBranchExists(data.branch);
  }

  if (data.branch || data.name) {
    await ensureUniqueServiceName(nextBranch, nextName, id);
  }

  const service = await Service.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate('branch', 'name city state');

  return service;
};

export const deleteService = async (id) => {
  const hasCounters = await Counter.exists({ service: id });

  if (hasCounters) {
    throw new ApiError(409, 'Cannot delete service with existing counters');
  }

  const service = await Service.findByIdAndDelete(id);

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }
};
