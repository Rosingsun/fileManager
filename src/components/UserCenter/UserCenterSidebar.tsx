import React from 'react'
import type { UserCenterNavItem, UserCenterTabKey } from './userCenterShared'

export interface UserCenterSidebarNavEntry extends UserCenterNavItem {
  icon: React.ReactNode
}

interface UserCenterSidebarProps {
  items: UserCenterSidebarNavEntry[]
  activeKey: UserCenterTabKey
  onChange: (key: UserCenterTabKey) => void
  profile: React.ReactNode
}

const GROUP_LABELS: Record<UserCenterNavItem['group'], string> = {
  workspace: '工作区',
  account: '账号',
  system: '其他',
}

const UserCenterSidebar: React.FC<UserCenterSidebarProps> = ({ items, activeKey, onChange, profile }) => {
  const groups: UserCenterNavItem['group'][] = ['workspace', 'account', 'system']

  return (
    <aside className="user-center-sidebar" aria-label="个人中心导航">
      <div className="user-center-sidebar__head">
        <h1 className="user-center-sidebar__title">个人中心</h1>
        <p className="user-center-sidebar__lead">账号、偏好与使用数据</p>
      </div>
      {profile}
      <nav className="user-center-nav">
        {groups.map((group) => {
          const groupItems = items.filter((item) => item.group === group)
          if (groupItems.length === 0) return null
          return (
            <div key={group} className="user-center-nav__group">
              <div className="user-center-nav__group-label">{GROUP_LABELS[group]}</div>
              <ul className="user-center-nav__list">
                {groupItems.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`user-center-nav__item${activeKey === item.key ? ' is-active' : ''}`}
                      aria-current={activeKey === item.key ? 'page' : undefined}
                      onClick={() => onChange(item.key)}
                    >
                      <span className="user-center-nav__icon" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="user-center-nav__label">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default UserCenterSidebar
