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

const ensureServiceBelongsToBranch = async (serviceId, branchId) => {
  const service = await Service.findOne({ _id: serviceId, branch: branchId });

  if (!service) {
    throw new ApiError(400, 'Service must belong to the selected branch');
  }
};

const ensureUniqueCounterNumber = async (branch, counterNumber, excludeId = null) => {
  const query = { branch, counterNumber };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const counter = await Counter.exists(query);

  if (counter) {
    throw new ApiError(409, 'Counter number already exists for this branch');
  }
};

export const createCounter = async (data) => {
  await ensureBranchExists(data.branch);
  await ensureServiceBelongsToBranch(data.service, data.branch);
  await ensureUniqueCounterNumber(data.branch, data.counterNumber);
  return Counter.create(data);
};

export const getCounters = async () => {
  return Counter.find()
    .populate('branch', 'name city state')
    .populate('service', 'name')
    .sort({ createdAt: -1 });
};

export const updateCounter = async (id, data) => {
  const existingCounter = await Counter.findById(id);

  if (!existingCounter) {
    throw new ApiError(404, 'Counter not found');
  }

  const nextBranch = data.branch ?? existingCounter.branch;
  const nextService = data.service ?? existingCounter.service;
  const nextCounterNumber = data.counterNumber ?? existingCounter.counterNumber;

  if (data.branch) {
    await ensureBranchExists(data.branch);
  }

  if (data.branch || data.service) {
    await ensureServiceBelongsToBranch(nextService, nextBranch);
  }

  if (data.branch || data.counterNumber) {
    await ensureUniqueCounterNumber(nextBranch, nextCounterNumber, id);
  }

  return Counter.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
    .populate('branch', 'name city state')
    .populate('service', 'name');
};

export const deleteCounter = async (id) => {
  const counter = await Counter.findByIdAndDelete(id);

  if (!counter) {
    throw new ApiError(404, 'Counter not found');
  }
};
