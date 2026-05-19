import React from 'react'
import { Avatar } from 'antd'
import type { AvatarProps } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useAvatarSrc } from '../hooks'

export interface UserAvatarProps extends Omit<AvatarProps, 'src'> {
  avatarUrl?: string | null
}

const UserAvatar: React.FC<UserAvatarProps> = ({ avatarUrl, icon, ...rest }) => {
  const { src, loading } = useAvatarSrc(avatarUrl)
  return (
    <Avatar
      {...rest}
      src={loading ? undefined : src}
      icon={icon ?? <UserOutlined />}
    />
  )
}

export default UserAvatar
