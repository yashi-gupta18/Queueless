import Branch from '../../models/branch.model.js';
import Counter from '../../models/counter.model.js';
import Organization from '../../models/organization.model.js';
import Service from '../../models/service.model.js';
import ApiError from '../../utils/apiError.js';

const ensureOrganizationExists = async (id) => {
  const organization = await Organization.exists({ _id: id });

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }
};

export const createBranch = async (data) => {
  await ensureOrganizationExists(data.organization);
  return Branch.create(data);
};

export const getBranches = async () => {
  return Branch.find().populate('organization', 'name').sort({ createdAt: -1 });
};

export const getBranchById = async (id) => {
  const branch = await Branch.findById(id).populate('organization', 'name');

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }

  return branch;
};

export const updateBranch = async (id, data) => {
  if (data.organization) {
    await ensureOrganizationExists(data.organization);
  }

  const branch = await Branch.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate('organization', 'name');

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }

  return branch;
};

export const deleteBranch = async (id) => {
  const hasServices = await Service.exists({ branch: id });
  const hasCounters = await Counter.exists({ branch: id });

  if (hasServices || hasCounters) {
    throw new ApiError(409, 'Cannot delete branch with existing services or counters');
  }

  const branch = await Branch.findByIdAndDelete(id);

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }
};
