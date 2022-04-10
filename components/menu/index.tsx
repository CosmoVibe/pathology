import React, { useContext, useEffect, useState } from 'react';
import Dimensions from '../../constants/dimensions';
import Directory from './directory';
import Dropdown from './dropdown';
import Link from 'next/link';
import LinkInfo from '../../models/linkInfo';
import { PageContext } from '../../contexts/pageContext';
import UserInfo from './userInfo';

interface MenuProps {
  folders?: LinkInfo[];
  subtitle?: LinkInfo;
  title?: LinkInfo;
}

export default function Menu(props: MenuProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [directoryWidth, setDirectoryWidth] = useState(0);
  const [userInfoWidth, setUserInfoWidth] = useState(0);
  const { windowSize } = useContext(PageContext);

  useEffect(() => {
    // this accounts for a bit more than the home button + dropdown button width
    const buffer = 100;
    setCollapsed(directoryWidth + userInfoWidth + buffer > windowSize.width);
  }, [directoryWidth, userInfoWidth, windowSize.width]);

  return (
    <div
      className={'select-none shadow-md'}
      style={{
        backgroundColor: 'var(--bg-color-2)',
        borderBottom: '1px solid',
        borderColor: 'var(--bg-color-4)',
        height: Dimensions.MenuHeight,
        position: 'fixed',
        top: 0,
        width: windowSize.width,
      }}
    >
      <div
        className={'cursor-default'}
        style={{
          float: 'left',
          paddingLeft: Dimensions.MenuPadding * 2,
          paddingRight: Dimensions.MenuPadding,
        }}
      >
        <Link href={'/'} passHref>
          <button
            className={'font-bold text-3xl'}
            style={{
              height: Dimensions.MenuHeight,
              width: 20,
            }}
          >
            P
          </button>
        </Link>
      </div>
      <Directory
        collapsed={collapsed}
        setWidth={setDirectoryWidth}
        {...props}
      />
      <div
        style={{
          float: 'right',
        }}
      >
        <UserInfo
          setWidth={setUserInfoWidth}
        />
        <Dropdown />
      </div>
    </div>
  );
}