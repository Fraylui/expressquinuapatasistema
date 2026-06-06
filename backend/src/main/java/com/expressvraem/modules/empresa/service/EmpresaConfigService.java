package com.expressvraem.modules.empresa.service;

import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.repository.EmpresaConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmpresaConfigService {

    private static final Long ID = 1L;

    private final EmpresaConfigRepository repo;

    public EmpresaConfig get() {
        return repo.findById(ID).orElseGet(this::defaultConfig);
    }

    @Transactional
    public EmpresaConfig save(EmpresaConfig cfg) {
        cfg.setId(ID);
        return repo.save(cfg);
    }

    // ── Valores por defecto si aún no se ha configurado ──────────────────────────
    private EmpresaConfig defaultConfig() {
        return EmpresaConfig.builder()
                .id(ID)
                .nombre("Mi Empresa de Transporte S.A.C.")
                .ruc("")
                .direccion("")
                .ciudad("")
                .telefono("")
                .logoBase64(null)
                .build();
    }
}
