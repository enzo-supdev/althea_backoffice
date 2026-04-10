import axiosInstance from './axiosInstance';
import { ApiResponse, MediaUploadResponse } from './types';

export const mediaApi = {
  async upload(file: File): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await axiosInstance.post<ApiResponse<MediaUploadResponse>>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  async getByRef(ref: string): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>(`/media/${ref}`, { responseType: 'blob' });
    return data;
  },

  async delete(ref: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(`/media/${ref}`);
    return data.data;
  },

  async bulkUpload(files: File[]): Promise<MediaUploadResponse[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const { data } = await axiosInstance.post<ApiResponse<MediaUploadResponse[]>>('/media/admin/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  async listAll(params?: { type?: 'image' | 'pdf' | 'document'; search?: string; page?: number; limit?: number }): Promise<unknown> {
    const { data } = await axiosInstance.get<ApiResponse<unknown>>('/media/admin/all', { params });
    return data.data;
  },
};