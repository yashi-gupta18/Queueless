import Branch from '../../models/branch.model.js';
import Organization from '../../models/organization.model.js';
import ApiError from '../../utils/apiError.js';

export const createOrganization = async (data, adminId) => {
  return Organization.create({ ...data, createdBy: adminId });
};

export const getOrganizations = async () => {
  return Organization.find().sort({ createdAt: -1 });
};

export const getOrganizationById = async (id) => {
  const organization = await Organization.findById(id);

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }

  return organization;
};

export const updateOrganization = async (id, data) => {
  const organization = await Organization.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }

  return organization;
};

export const deleteOrganization = async (id) => {
  const hasBranches = await Branch.exists({ organization: id });

  if (hasBranches) {
    throw new ApiError(409, 'Cannot delete organization with existing branches');
  }

  const organization = await Organization.findByIdAndDelete(id);

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }
};
