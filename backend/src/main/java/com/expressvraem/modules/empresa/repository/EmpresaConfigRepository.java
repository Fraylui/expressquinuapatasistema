package com.expressvraem.modules.empresa.repository;

import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EmpresaConfigRepository extends JpaRepository<EmpresaConfig, Long> {
}
